"use client";

import { useRef, useState } from "react";
import type { RefObject } from "react";
import type maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import { angDelta, haversineMeters, predictPath } from "@/lib/geo";
import { posSecs } from "@/lib/format";
import type { StateVector } from "@/lib/types";

type UseNearMissRadarArgs = {
  mapRef: RefObject<maplibregl.Map | null>;
};

/**
 * Near-miss radar: derives each airborne plane's turn rate from consecutive
 * heading samples, then flags pairs whose 2-minute forecasts pass within
 * ~5nm horizontally AND ~600m vertically. Draws red links between flagged
 * pairs into the map's `conflicts` source and tracks the count for the HUD
 * badge.
 */
export function useNearMissRadar({ mapRef }: UseNearMissRadarArgs) {
  const [conflictCount, setConflictCount] = useState(0);
  const turnRateRef = useRef<Map<string, number>>(new Map());
  const prevTrackRef = useRef<Map<string, { track: number; t: number }>>(
    new Map()
  );

  // Derive each plane's turn rate (signed deg/s) by diffing its heading
  // against the previous sample. Clamped to ±3 deg/s (airliner standard-rate
  // ceiling) to reject heading jitter. Refreshes only when a newer position
  // timestamp lands.
  function updateTurnRates(list: StateVector[]) {
    for (const p of list) {
      if (typeof p.true_track !== "number") continue;
      const t = posSecs(p.last_time_position);
      if (Number.isNaN(t)) continue;
      const prev = prevTrackRef.current.get(p.icao24);
      if (prev && t > prev.t) {
        const raw = angDelta(p.true_track, prev.track) / (t - prev.t);
        turnRateRef.current.set(p.icao24, Math.max(-3, Math.min(3, raw)));
      }
      prevTrackRef.current.set(p.icao24, { track: p.true_track, t });
    }
  }

  function drawConflicts(list: StateVector[]) {
    const src = mapRef.current?.getSource("conflicts") as
      | GeoJSONSource
      | undefined;
    if (!src) return;
    const air = list.filter(
      (p) =>
        !p.on_ground &&
        typeof p.velocity === "number" &&
        typeof p.true_track === "number"
    );
    const paths = air.map((p) => ({
      p,
      path: predictPath(
        p.longitude,
        p.latitude,
        p.velocity,
        p.true_track,
        turnRateRef.current.get(p.icao24) ?? 0
      ),
    }));
    const feats: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    for (let i = 0; i < paths.length; i++) {
      for (let j = i + 1; j < paths.length; j++) {
        const A = paths[i];
        const B = paths[j];
        const altA = A.p.baro_altitude;
        const altB = B.p.baro_altitude;
        if (
          typeof altA === "number" &&
          typeof altB === "number" &&
          Math.abs(altA - altB) > 600
        ) {
          continue;
        }
        const n = Math.min(A.path.length, B.path.length);
        let min = Infinity;
        for (let k = 0; k < n; k++) {
          const d = haversineMeters(A.path[k], B.path[k]);
          if (d < min) min = d;
        }
        if (min < 9260) {
          feats.push({
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [
                [A.p.longitude, A.p.latitude],
                [B.p.longitude, B.p.latitude],
              ],
            },
            properties: {},
          });
        }
      }
    }
    src.setData({ type: "FeatureCollection", features: feats });
    setConflictCount(feats.length);
  }

  return {
    conflictCount,
    turnRateRef, 
    updateTurnRates,
    drawConflicts,
  };
}