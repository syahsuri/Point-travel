"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import { loadHistory } from "@/lib/history";
import { greatCircle, smoothPath, pointAlong } from "@/lib/geo";
import {
  SELECTED_PLANE_ICON_SRC,
  SELECTED_PLANE_ICON_W,
  SELECTED_PLANE_ICON_H,
} from "@/lib/mapConstants";
import type { StateVector, TripHistory } from "@/lib/types";

type UsePlaneSelectionArgs = {
  mapRef: RefObject<maplibregl.Map | null>;
  airportsRef: RefObject<Record<string, [number, number]>>;
  onSelect: () => void; // called to close any open airport selection first
};

/**
 * Owns everything related to selecting a plane: the selected plane itself,
 * its flown-history track, camera auto-follow, prediction-accuracy scoring,
 * and the flight-replay scrubber. Also owns the map-side trajectory
 * rendering (rainbow line, selected-plane marker, destination line) and the
 * replay-head marker effect.
 *
 * Exposes several refs (`selectedIcaoRef`, `followRef`, `basePathRef`,
 * `predictedRef`, `selectedMarkerRef`) because the map's per-frame animation
 * loop (owned elsewhere) needs to read/write them every tick without
 * triggering React re-renders.
 */
export function usePlaneSelection({
  mapRef,
  airportsRef,
  onSelect,
}: UsePlaneSelectionArgs) {
  const [selected, setSelected] = useState<StateVector | null>(null);
  const [history, setHistory] = useState<TripHistory | null>(null);
  const [follow, setFollow] = useState(false);
  const [accuracyKm, setAccuracyKm] = useState<number | null>(null);
  const [replayT, setReplayT] = useState(0);
  const [replaying, setReplaying] = useState(false);

  const followRef = useRef(false);
  const historyTripRef = useRef<string | null>(null);
  const selectedIcaoRef = useRef<string | null>(null);
  const basePathRef = useRef<[number, number][]>([]);
  const selectedMarkerRef = useRef<maplibregl.Marker | null>(null);
  const predictedRef = useRef<{ icao: string; lon: number; lat: number } | null>(
    null
  );
  const trajectoryLoadingRef = useRef(false);

  function clearTrajectory() {
    const src = mapRef.current?.getSource("trajectory") as
      | GeoJSONSource
      | undefined;
    src?.setData({ type: "FeatureCollection", features: [] });
  }

  function setTrajectory(path: [number, number][]) {
    const map = mapRef.current;
    const src = map?.getSource("trajectory") as GeoJSONSource | undefined;
    if (!map || !src || path.length < 2) {
      clearTrajectory();
      return;
    }
    src.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "LineString", coordinates: path },
          properties: {},
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: path[0] },
          properties: {},
        },
      ],
    });
  }

  function setTrajectoryLoading(loading: boolean) {
    trajectoryLoadingRef.current = loading;
    const map = mapRef.current;
    if (!map || !map.getLayer("trajectory-line")) return;
    map.setPaintProperty("trajectory-line", "line-opacity", loading ? 0.35 : 1);
    map.setPaintProperty(
      "trajectory-line",
      "line-dasharray",
      loading ? [0.6, 1.4] : undefined
    );
    map.setPaintProperty(
      "trajectory-glow",
      "line-opacity",
      loading ? 0.12 : 0.3
    );
  }

  function drawTrajectory(originIata: string | null, current: [number, number]) {
    const origin = originIata ? airportsRef.current[originIata] : undefined;
    if (!origin) {
      clearTrajectory();
      return;
    }
    setTrajectory(greatCircle(origin, current));
  }

  // Select a plane: open sidebar, draw the great-circle placeholder + fly to
  // it, then fetch the real flown path and replace the placeholder when it
  // arrives.
  function selectPlane(p: StateVector) {
    const map = mapRef.current;
    onSelect(); // close any open airport selection
    setSelected(p);
    historyTripRef.current = p.trip_id;
    selectedIcaoRef.current = p.icao24;
    predictedRef.current = null;
    setAccuracyKm(null);
    setReplaying(false);
    setReplayT(0);
    setHistory(null);

    const origin = p.origin_iata ? airportsRef.current[p.origin_iata] : undefined;
    basePathRef.current = origin
      ? greatCircle(origin, [p.longitude, p.latitude])
      : [];
    drawTrajectory(p.origin_iata, [p.longitude, p.latitude]);
    setTrajectoryLoading(true);

    // Origin / destination airport pins (whichever resolve in the lookup).
    const endpointFeats: GeoJSON.Feature<GeoJSON.Point>[] = [];
    for (const iata of [p.origin_iata, p.destination_iata]) {
      const coord = iata ? airportsRef.current[iata] : undefined;
      if (coord) {
        endpointFeats.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: coord },
          properties: { iata },
        });
      }
    }
    (map?.getSource("endpoints") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: endpointFeats,
    });

    // Swap the static icon for the selected plane icon while selected: hide
    // this plane in the symbol layer and float an HTML marker in its place.
    selectedMarkerRef.current?.remove();
    if (map) {
      if (map.getLayer("planes")) {
        map.setFilter("planes", ["!=", ["get", "icao24"], p.icao24]);
      }
      const wrap = document.createElement("div");
      wrap.style.cssText = "pointer-events:none;line-height:0";
      const img = document.createElement("img");
      img.src = SELECTED_PLANE_ICON_SRC;
      img.alt = "";
      img.style.cssText = `height:${SELECTED_PLANE_ICON_H}px;width:${SELECTED_PLANE_ICON_W}px;display:block;`;
      wrap.appendChild(img);
      selectedMarkerRef.current = new maplibregl.Marker({
        element: wrap,
        anchor: "center",
      })
        .setLngLat([p.longitude, p.latitude])
        .addTo(map);
    }

    // Draw the green dotted line to destination airport.
    const destCoord = p.destination_iata
      ? airportsRef.current[p.destination_iata]
      : undefined;
    const destSrc = map?.getSource("destination-path") as
      | GeoJSONSource
      | undefined;
    if (destSrc) {
      if (destCoord) {
        destSrc.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: greatCircle([p.longitude, p.latitude], destCoord),
              },
              properties: {},
            },
          ],
        });
      } else {
        destSrc.setData({ type: "FeatureCollection", features: [] });
      }
    }

    map?.flyTo({
      center: [p.longitude, p.latitude],
      zoom: Math.max(map.getZoom(), 7),
    });

    if (!p.trip_id) {
      setTrajectoryLoading(false);
      return;
    }
    loadHistory(p.trip_id).then((h) => {
      if (historyTripRef.current !== p.trip_id) return;
      setHistory(h);
      if (h.path.length >= 2) {
        const smoothed = smoothPath(h.path, 4);
        basePathRef.current = smoothed;
        setTrajectory(smoothed);
      }
      setTrajectoryLoading(false);
    });
  }

  // Deselect: close sidebar + clear trajectory, reset line style for next pick.
  function deselectPlane() {
    setSelected(null);
    setHistory(null);
    historyTripRef.current = null;
    selectedIcaoRef.current = null;
    basePathRef.current = [];
    setTrajectoryLoading(false);
    selectedMarkerRef.current?.remove();
    selectedMarkerRef.current = null;

    if (mapRef.current?.getLayer("planes")) {
      mapRef.current.setFilter("planes", null);
    }
    clearTrajectory();
    (mapRef.current?.getSource("destination-path") as GeoJSONSource | undefined)?.setData(
      { type: "FeatureCollection", features: [] }
    );
    (mapRef.current?.getSource("prediction") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: [],
    });
    (mapRef.current?.getSource("turn-marker") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: [],
    });
    (mapRef.current?.getSource("endpoints") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: [],
    });

    setFollow(false);
    followRef.current = false;
    predictedRef.current = null;
    setAccuracyKm(null);
    setReplaying(false);
    setReplayT(0);
  }

  function toggleFollow() {
    setFollow((prev) => {
      const next = !prev;
      followRef.current = next;
      return next;
    });
  }

  // Draw the replay head at the current scrub position along the selected
  // trip's recorded path (empty when there's no path).
  useEffect(() => {
    const src = mapRef.current?.getSource("replay") as GeoJSONSource | undefined;
    if (!src) return;
    const path = history?.path;
    const smoothed = path && path.length >= 2 ? smoothPath(path, 4) : null;
    const pt = smoothed ? pointAlong(smoothed, replayT) : null;
    src.setData({
      type: "FeatureCollection",
      features: pt
        ? [{ type: "Feature", geometry: { type: "Point", coordinates: pt }, properties: {} }]
        : [],
    });
  }, [replayT, history, mapRef]);

  // Auto-play the replay: advance the scrubber ~5s end-to-end, stop at the end.
  useEffect(() => {
    if (!replaying) return;
    const id = setInterval(() => {
      setReplayT((t) => {
        const nt = t + 0.02;
        if (nt >= 1) {
          setReplaying(false);
          return 1;
        }
        return nt;
      });
    }, 100);
    return () => clearInterval(id);
  }, [replaying]);

  return {
    selected,
    setSelected, // exposed for the map engine's poll loop, which refreshes `selected` with fresh data
    history,
    follow,
    toggleFollow,
    followRef,
    accuracyKm,
    setAccuracyKm, // exposed for the map engine's prediction-accuracy scoring
    replayT,
    setReplayT,
    replaying,
    setReplaying,
    selectPlane,
    deselectPlane,
    // Refs the map engine's animation loop needs direct access to:
    selectedIcaoRef,
    basePathRef,
    selectedMarkerRef,
    predictedRef,
    trajectoryLoadingRef,
    historyTripRef,
    // Trajectory helpers the map engine also calls directly (e.g. inside the
    // animate loop to update the destination-path/prediction sources):
    setTrajectory,
    clearTrajectory,
    setTrajectoryLoading,
    drawTrajectory,
  };
}