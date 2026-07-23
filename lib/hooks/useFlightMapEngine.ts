"use client";

import { useEffect } from "react";
import type { RefObject } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import { loadPlanes } from "@/lib/planes";
import { loadAirports } from "@/lib/airports";
import { setBasemap, BASE_STYLE } from "@/lib/mapStyle";
import {
  deadReckon,
  greatCircle,
  predictPath,
  smoothPath,
  haversineMeters,
} from "@/lib/geo";
import {
  INDONESIA_BOUNDS,
  PLANE_ICON_SRC,
  PLANE_ICON_W,
  PLANE_ICON_H,
} from "@/lib/mapConstants";
import type { StateVector, Airport } from "@/lib/types";

type UseFlightMapEngineArgs = {
  containerRef: RefObject<HTMLDivElement | null>;
  mapRef: RefObject<maplibregl.Map | null>;
  airportsRef: RefObject<Record<string, [number, number]>>;
  planesRef: RefObject<StateVector[]>;
  setAirports: (v: Record<string, [number, number]>) => void;
  setAirportList: (v: Airport[]) => void;
  setPlaneList: (v: StateVector[]) => void;
  // Plane selection (from usePlaneSelection)
  selectPlane: (p: StateVector) => void;
  deselectPlane: () => void;
  // Airport selection (from useAirportSelection)
  setSelectedAirport: (a: Airport | null) => void;
  setAirportBoardTab: (t: "arrival" | "departure") => void;
  deselectAirport: () => void;
  baseTimeRef: RefObject<number>;
  lastApiTimeRef: RefObject<number>;
  selectedIcaoRef: RefObject<string | null>;
  followRef: RefObject<boolean>;
  basePathRef: RefObject<[number, number][]>;
  selectedMarkerRef: RefObject<maplibregl.Marker | null>;
  turnRateRef: RefObject<Map<string, number>>;
  predictedRef: RefObject<{ icao: string; lon: number; lat: number } | null>;
  setSelected: (
    updater: (prev: StateVector | null) => StateVector | null
  ) => void;
  setAccuracyKm: (v: number | null) => void;
  updateTurnRates: (list: StateVector[]) => void;
  drawConflicts: (list: StateVector[]) => void;
};

/**
 * Bootstraps the MapLibre map: creates it, loads icons + initial data,
 * adds every source/layer (trajectory, prediction, turn indicator,
 * destination path, endpoints, near-miss conflicts, replay head, airports,
 * planes), wires click/hover handlers, then runs the animate + poll loops.
 *
 * Runs once on mount. Cleans up the map instance on unmount.
 */

function planesToGeoJSON(
  planes: StateVector[]
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: planes.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
      properties: {
        icao24: p.icao24,
        callsign: (p.callsign ?? "").trim() || "N/A",
        track: p.true_track ?? 0,
        baro_altitude: p.baro_altitude,
        velocity: p.velocity,
        on_ground: p.on_ground,
        origin_iata: p.origin_iata,
        destination_iata: p.destination_iata,
        model: p.model,
        typecode: p.typecode,
        registration: p.registration,
        owner: p.owner,
        flight_status: p.flight_status,
        last_time_position: p.last_time_position,
      },
    })),
  };
}

export function useFlightMapEngine({
  containerRef,
  mapRef,
  airportsRef,
  planesRef,
  setAirports,
  setAirportList,
  setPlaneList,
  selectPlane,
  deselectPlane,
  setSelectedAirport,
  setAirportBoardTab,
  deselectAirport,
  baseTimeRef,
  lastApiTimeRef,
  selectedIcaoRef,
  followRef,
  basePathRef,
  selectedMarkerRef,
  turnRateRef,
  predictedRef,
  setSelected,
  setAccuracyKm,
  updateTurnRates,
  drawConflicts,
}: UseFlightMapEngineArgs) {
  useEffect(() => {
    if (!containerRef.current) return;

    fetch("/data/airports.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((j) => {
        airportsRef.current = j as Record<string, [number, number]>;
        setAirports(airportsRef.current);
      })
      .catch((err) => console.error("[airports-local]", err));

    const airportsPromise = loadAirports()
      .then((list) => {
        setAirportList(list);
        return list;
      })
      .catch((err) => {
        console.error("[airports-api]", err);
        return [] as Airport[];
      });

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_STYLE,
      bounds: INDONESIA_BOUNDS,
      fitBoundsOptions: { padding: 20 },
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
    });
    mapRef.current = map;

    let pollId: ReturnType<typeof setInterval> | undefined;
    let rafId: number | undefined;

    map.on("error", (e) => console.error("[map]", e?.error ?? e));

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    );
    map.addControl(
      new maplibregl.AttributionControl({
        customAttribution: "Basemap © Natural Earth (public domain)",
      })
    );

    map.on("load", async () => {
      map.resize();
      setBasemap(map, "streets");

      const img = new Image(PLANE_ICON_W, PLANE_ICON_H);
      img.onload = async () => {
        if (!map.hasImage("plane")) {
          map.addImage("plane", img, { pixelRatio: 2 });
        }

        const loadIcon = (src: string, name: string) =>
          new Promise<void>((resolve) => {
            const im = new Image();
            im.onload = () => {
              if (!map.hasImage(name))
                map.addImage(name, im, { pixelRatio: 2 });
              resolve();
            };
            im.onerror = () => resolve();
            im.src = src;
          });
        await Promise.all([
          loadIcon("/icons/airport-unselected.png", "airport-unselected"),
          loadIcon("/icons/airport.png", "airport-selected"),
          loadIcon("/icons/nyan-cat.gif", "plane-chaos"),
        ]);

        let planes: StateVector[] = [];
        try {
          const res = await loadPlanes();
          planes = res.states;
          lastApiTimeRef.current = res.time;
        } catch (err) {
          console.error(err);
        }

        setPlaneList(planes);
        planesRef.current = planes;
        updateTurnRates(planes);
        baseTimeRef.current = Date.now();

        // ---- Sources & layers ----

        // Trajectory: rainbow flown-path line + origin dot.
        map.addSource("trajectory", {
          type: "geojson",
          lineMetrics: true,
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "trajectory-glow",
          type: "line",
          source: "trajectory",
          filter: ["==", ["geometry-type"], "LineString"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#ffffff",
            "line-width": 9,
            "line-blur": 8,
            "line-opacity": 0.3,
          },
        });
        map.addLayer({
          id: "trajectory-line",
          type: "line",
          source: "trajectory",
          filter: ["==", ["geometry-type"], "LineString"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-width": 4,
            "line-opacity": 1,
            "line-gradient": [
              "interpolate",
              ["linear"],
              ["line-progress"],
              0.0,
              "#ff2b2b",
              0.2,
              "#ff9500",
              0.4,
              "#ffe600",
              0.6,
              "#33dd33",
              0.8,
              "#00a3ff",
              1.0,
              "#8a2be2",
            ],
          },
        });
        map.addLayer({
          id: "origin-glow",
          type: "circle",
          source: "trajectory",
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-radius": 11,
            "circle-color": "#22d3ee",
            "circle-blur": 1,
            "circle-opacity": 0.5,
          },
        });
        map.addLayer({
          id: "trajectory-origin",
          type: "circle",
          source: "trajectory",
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-radius": 4.5,
            "circle-color": "#e0fbff",
            "circle-stroke-color": "#0b1622",
            "circle-stroke-width": 1.5,
          },
        });

        // Forward "next 2 min" prediction — yellow dashed line.
        map.addSource("prediction", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "prediction-glow",
          type: "line",
          source: "prediction",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#facc15",
            "line-width": 7,
            "line-blur": 7,
            "line-opacity": 0.4,
          },
        });
        map.addLayer({
          id: "prediction-line",
          type: "line",
          source: "prediction",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#fde047",
            "line-width": 2,
            "line-dasharray": [0.4, 2],
            "line-opacity": 1,
          },
        });

        // Amber ring around the plane while it's turning.
        map.addSource("turn-marker", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "turn-marker-glow",
          type: "circle",
          source: "turn-marker",
          paint: {
            "circle-radius": 16,
            "circle-color": "#facc15",
            "circle-blur": 1,
            "circle-opacity": 0.35,
          },
        });
        map.addLayer({
          id: "turn-marker-ring",
          type: "circle",
          source: "turn-marker",
          paint: {
            "circle-radius": 13,
            "circle-opacity": 0,
            "circle-stroke-color": "#fde047",
            "circle-stroke-width": 2,
          },
        });

        // Green dotted path from current position to destination airport.
        map.addSource("destination-path", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "destination-line",
          type: "line",
          source: "destination-path",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#10b981",
            "line-width": 3.5,
            "line-dasharray": [0.01, 2],
            "line-opacity": 0.85,
          },
        });

        // Origin / destination airport pins for the selected flight.
        map.addSource("endpoints", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "endpoint-dot",
          type: "circle",
          source: "endpoints",
          paint: {
            "circle-radius": 5,
            "circle-color": "#ffffff",
            "circle-stroke-color": "#0b1622",
            "circle-stroke-width": 2,
          },
        });
        map.addLayer({
          id: "endpoint-label",
          type: "symbol",
          source: "endpoints",
          layout: {
            "text-field": ["get", "iata"],
            "text-font": ["Noto Sans Bold"],
            "text-size": 12,
            "text-offset": [0, -1.1],
            "text-anchor": "bottom",
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "#0b1622",
            "text-halo-width": 1.4,
          },
        });

        // Near-miss radar links.
        map.addSource("conflicts", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "conflict-glow",
          type: "line",
          source: "conflicts",
          layout: { "line-cap": "round" },
          paint: {
            "line-color": "#ff3b3b",
            "line-width": 8,
            "line-blur": 8,
            "line-opacity": 0.4,
          },
        });
        map.addLayer({
          id: "conflict-line",
          type: "line",
          source: "conflicts",
          layout: { "line-cap": "round" },
          paint: {
            "line-color": "#ff5555",
            "line-width": 2,
            "line-dasharray": [1, 1],
            "line-opacity": 0.9,
          },
        });

        drawConflicts(planes);

        // Flight-replay head marker.
        map.addSource("replay", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "replay-glow",
          type: "circle",
          source: "replay",
          paint: {
            "circle-radius": 12,
            "circle-color": "#ffffff",
            "circle-blur": 1,
            "circle-opacity": 0.4,
          },
        });
        map.addLayer({
          id: "replay-dot",
          type: "circle",
          source: "replay",
          paint: {
            "circle-radius": 6,
            "circle-color": "#ffffff",
            "circle-stroke-color": "#8a2be2",
            "circle-stroke-width": 2,
          },
        });

        // Airport markers — rendered before planes so planes sit on top.
        airportsPromise
          .then((list) => {
            if (!map.getSource("airports")) {
              map.addSource("airports", {
                type: "geojson",
                data: {
                  type: "FeatureCollection",
                  features: list.map((a) => ({
                    type: "Feature" as const,
                    geometry: {
                      type: "Point" as const,
                      coordinates: [a.longitude_deg, a.latitude_deg],
                    },
                    properties: {
                      name: a.name,
                      iata: a.iata_code ?? "",
                      icao: a.icao_code ?? "",
                      country: a.iso_country,
                      type: a.type,
                    },
                  })),
                },
              });

              map.addLayer({
                id: "airport-dot",
                type: "symbol",
                source: "airports",
                minzoom: 4,
                layout: {
                  "icon-image": "airport-unselected",
                  "icon-size": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    4,
                    0.15,
                    10,
                    0.3,
                  ],
                  "icon-allow-overlap": true,
                  "icon-ignore-placement": true,
                },
              });

              map.addLayer({
                id: "airport-label",
                type: "symbol",
                source: "airports",
                minzoom: 6,
                filter: ["!=", ["get", "iata"], ""],
                layout: {
                  "text-field": ["get", "iata"],
                  "text-font": ["Noto Sans Bold"],
                  "text-size": 10,
                  "text-offset": [0, -1.4],
                  "text-anchor": "bottom",
                  "text-allow-overlap": false,
                  "text-ignore-placement": false,
                },
                paint: {
                  "text-color": "#bae6fd",
                  "text-halo-color": "#0b1622",
                  "text-halo-width": 1.2,
                },
              });

              map.addSource("selected-airport", {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
              });
              map.addLayer({
                id: "selected-airport-icon",
                type: "symbol",
                source: "selected-airport",
                layout: {
                  "icon-image": "airport-selected",
                  "icon-size": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    4,
                    0.45,
                    10,
                    0.75,
                  ],
                  "icon-allow-overlap": true,
                  "icon-ignore-placement": true,
                },
              });

              map.on("click", "airport-dot", (e) => {
                e.preventDefault();
                const f = e.features?.[0];
                if (!f) return;
                const props = f.properties as {
                  name: string;
                  iata: string;
                  icao: string;
                  country: string;
                  type: string;
                };
                const coords = (f.geometry as GeoJSON.Point).coordinates as [
                  number,
                  number
                ];
                deselectPlane();
                setSelectedAirport({
                  name: props.name,
                  iata_code: props.iata || null,
                  icao_code: props.icao || null,
                  iso_country: props.country,
                  type: props.type,
                  longitude_deg: coords[0],
                  latitude_deg: coords[1],
                });
                setAirportBoardTab("departure");
                map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 8) });
              });
              map.on("mouseenter", "airport-dot", () => {
                map.getCanvas().style.cursor = "pointer";
              });
              map.on("mouseleave", "airport-dot", () => {
                map.getCanvas().style.cursor = "";
              });
            }
          })
          .catch((err) => console.error("[airports-layer]", err));

        map.addSource("planes", {
          type: "geojson",
          data: planesToGeoJSON(planes),
        });

        map.addLayer({
          id: "planes",
          type: "symbol",
          source: "planes",
          layout: {
            "icon-image": "plane",
            "icon-rotate": ["-", ["get", "track"], 45],
            "icon-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              4,
              0.6,
              7,
              0.9,
              10,
              1.2,
              13,
              1.5,
            ],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
          },
        });

        airportsPromise.then(() => {
          if (map.getLayer("planes")) {
            map.moveLayer("planes");
          }
        });

        map.on("click", "planes", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const icao = f.properties?.icao24;
          const full =
            typeof icao === "string"
              ? planesRef.current.find((p) => p.icao24 === icao)
              : undefined;
          if (full) {
            deselectAirport();
            selectPlane(full);
          }
        });

        map.on("click", (e) => {
          const hits = map.queryRenderedFeatures(e.point, {
            layers: ["planes", "airport-dot"],
          });
          if (!hits.length) {
            deselectPlane();
            deselectAirport();
          }
        });
        map.on("mouseenter", "planes", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "planes", () => {
          map.getCanvas().style.cursor = "";
        });

        // ---- Animate loop: dead-reckons plane positions between polls ----
        let lastDraw = 0;
        const animate = () => {
          rafId = requestAnimationFrame(animate);
          const now = performance.now();
          if (now - lastDraw < 100) return;
          lastDraw = now;
          const src = map.getSource("planes") as GeoJSONSource | undefined;
          if (!src) return;
          const dt = (Date.now() - baseTimeRef.current) / 1000;
          const moved = planesRef.current.map((p) => {
            if (p.on_ground) return p;
            const [lng, lat] = deadReckon(
              p.longitude,
              p.latitude,
              p.velocity,
              p.true_track,
              dt
            );
            return { ...p, longitude: lng, latitude: lat };
          });
          src.setData(planesToGeoJSON(moved));
          const selIcao = selectedIcaoRef.current;
          if (!selIcao) return;
          const sel = moved.find((p) => p.icao24 === selIcao);
          if (!sel) return;
          const head: [number, number] = [sel.longitude, sel.latitude];

          if (followRef.current) map.setCenter(head);
          const traj = map.getSource("trajectory") as GeoJSONSource | undefined;
          const base = basePathRef.current;
          if (traj && base.length >= 1) {
            traj.setData({
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  geometry: {
                    type: "LineString",
                    coordinates: [...base, head],
                  },
                  properties: {},
                },
                {
                  type: "Feature",
                  geometry: { type: "Point", coordinates: base[0] },
                  properties: {},
                },
              ],
            });
          }
          const destIata = sel.destination_iata;
          const destCoord = destIata
            ? airportsRef.current[destIata]
            : undefined;
          const destSrc = map.getSource("destination-path") as
            | GeoJSONSource
            | undefined;
          if (destSrc) {
            destSrc.setData(
              destCoord
                ? {
                    type: "FeatureCollection",
                    features: [
                      {
                        type: "Feature",
                        geometry: {
                          type: "LineString",
                          coordinates: greatCircle(head, destCoord),
                        },
                        properties: {},
                      },
                    ],
                  }
                : { type: "FeatureCollection", features: [] }
            );
          }
          const omega = turnRateRef.current.get(selIcao) ?? 0;
          const pred = map.getSource("prediction") as GeoJSONSource | undefined;
          const ppathRaw = sel.on_ground
            ? []
            : predictPath(
                sel.longitude,
                sel.latitude,
                sel.velocity,
                sel.true_track,
                omega
              );
          const ppath =
            ppathRaw.length >= 3 ? smoothPath(ppathRaw, 1) : ppathRaw;
          pred?.setData({
            type: "FeatureCollection",
            features:
              ppath.length >= 2
                ? [
                    {
                      type: "Feature",
                      geometry: { type: "LineString", coordinates: ppath },
                      properties: {},
                    },
                  ]
                : [],
          });
          const turning = !sel.on_ground && Math.abs(omega) >= 0.15;
          const turnSrc = map.getSource("turn-marker") as
            | GeoJSONSource
            | undefined;
          turnSrc?.setData({
            type: "FeatureCollection",
            features: turning
              ? [
                  {
                    type: "Feature",
                    geometry: { type: "Point", coordinates: head },
                    properties: {},
                  },
                ]
              : [],
          });
          const selectedMarker = selectedMarkerRef.current;
          if (selectedMarker) {
            selectedMarker.setLngLat(head);
            const imgEl = selectedMarker.getElement()
              .firstElementChild as HTMLElement | null;
            if (imgEl) {
              const h = sel.true_track;
              imgEl.style.transform =
                typeof h === "number" ? `rotate(${h - 45}deg)` : "none";
            }
          }
        };
        rafId = requestAnimationFrame(animate);

        // ---- Poll loop: fetches fresh state vectors every 30s ----
        const POLL_MS = 30_000;
        pollId = setInterval(async () => {
          try {
            const res = await loadPlanes();
            if (res.time > lastApiTimeRef.current) {
              const next = res.states;
              lastApiTimeRef.current = res.time;
              setPlaneList(next);
              planesRef.current = next;
              updateTurnRates(next);
              drawConflicts(next);
              baseTimeRef.current = Date.now();

              const selIcao = selectedIcaoRef.current;
              const actual = selIcao
                ? next.find((p) => p.icao24 === selIcao)
                : undefined;
              if (actual) {
                const pr = predictedRef.current;
                if (pr && pr.icao === selIcao) {
                  setAccuracyKm(
                    haversineMeters(
                      [actual.longitude, actual.latitude],
                      [pr.lon, pr.lat]
                    ) / 1000
                  );
                }
                if (
                  typeof actual.velocity === "number" &&
                  typeof actual.true_track === "number"
                ) {
                  const omega = turnRateRef.current.get(selIcao!) ?? 0;
                  const pth = predictPath(
                    actual.longitude,
                    actual.latitude,
                    actual.velocity,
                    actual.true_track,
                    omega,
                    POLL_MS / 1000,
                    10
                  );
                  const end = pth[pth.length - 1];
                  predictedRef.current = {
                    icao: selIcao!,
                    lon: end[0],
                    lat: end[1],
                  };
                } else {
                  predictedRef.current = null;
                }
              }
              setSelected((prev) =>
                prev ? next.find((p) => p.icao24 === prev.icao24) ?? prev : null
              );
            }
          } catch (err) {
            console.error(err);
          }
        }, POLL_MS);
      }; // end img.onload
      img.src = PLANE_ICON_SRC;
    }); // end map.on("load", async () => { ... })

    return () => {
      if (pollId) clearInterval(pollId);
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
