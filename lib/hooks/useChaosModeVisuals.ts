"use client";

import { useEffect } from "react";
import type { RefObject } from "react";
import type maplibregl from "maplibre-gl";

type UseChaosModeVisualsArgs = {
  mapRef: RefObject<maplibregl.Map | null>;
  active: boolean;
};

const NORMAL_ICON_SIZE = [
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
] as const;

/**
 * Drives the `planes` layer's visuals during chaos mode: swaps the icon to
 * the Nyan Cat gif and pulses its size via a rAF loop. Reverts to the normal
 * plane icon/size when `active` turns false.
 */
export function useChaosModeVisuals({ mapRef, active }: UseChaosModeVisualsArgs) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.getLayer("planes")) return;

    if (!active) {
      map.setLayoutProperty("planes", "icon-size", [...NORMAL_ICON_SIZE]);
      map.setLayoutProperty("planes", "icon-image", "plane");
      return;
    }

    map.setLayoutProperty("planes", "icon-image", "plane-chaos");

    let raf: number;
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      const pulse = 0.5 + 0.1 * Math.sin(t * 6);
      map.setLayoutProperty("planes", "icon-size", [
        "interpolate",
        ["linear"],
        ["zoom"],
        4,
        0.6 * pulse,
        7,
        0.9 * pulse,
        10,
        1.2 * pulse,
        13,
        1.5 * pulse,
      ]);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, mapRef]);
}