import type { ExpressionSpecification } from "maplibre-gl";

export const ALTITUDE_COLOR_STOPS: [number, string][] = [
  [0, "#ff3b1f"],
  [300, "#ff8c00"],
  [900, "#ffd400"],
  [1800, "#7ee000"],
  [3000, "#00e0a0"],
  [6000, "#00aaff"],
  [9000, "#6a5cff"],
  [12000, "#d61fd6"],
];

const GROUND_COLOR = "#8a8f98";

export function altitudeColorExpression(): ExpressionSpecification {
  const stops = ALTITUDE_COLOR_STOPS.flatMap(([alt, color]) => [alt, color]);
  return [
    "case",
    [
      "any",
      ["==", ["get", "flight_status"], "Landed"],
      ["==", ["get", "on_ground"], true],
    ],
    GROUND_COLOR,
    ["interpolate", ["linear"], ["get", "baro_altitude"], ...stops],
  ] as unknown as ExpressionSpecification;
}

/**
 * Same color ramp as altitudeColorExpression(), computed in plain JS for
 * DOM elements (e.g. the floating selected-plane marker) that can't use
 * MapLibre paint expressions. Mirrors the same ground/status handling and
 * linear interpolation between ALTITUDE_COLOR_STOPS.
 */
export function altitudeColorForValue(
  altitude: number | null,
  opts?: { onGround?: boolean; flightStatus?: string | null }
): string {
  if (opts?.onGround || opts?.flightStatus === "Landed") {
    return GROUND_COLOR;
  }
  if (typeof altitude !== "number" || !Number.isFinite(altitude)) {
    return GROUND_COLOR;
  }

  const stops = ALTITUDE_COLOR_STOPS;
  if (altitude <= stops[0][0]) return stops[0][1];
  if (altitude >= stops[stops.length - 1][0]) {
    return stops[stops.length - 1][1];
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const [a0, c0] = stops[i];
    const [a1, c1] = stops[i + 1];
    if (altitude >= a0 && altitude <= a1) {
      const t = (altitude - a0) / (a1 - a0);
      return lerpHexColor(c0, c1, t);
    }
  }
  return stops[stops.length - 1][1];
}

function lerpHexColor(hex0: string, hex1: string, t: number): string {
  const c0 = parseInt(hex0.replace("#", ""), 16);
  const c1 = parseInt(hex1.replace("#", ""), 16);
  const r0 = (c0 >> 16) & 255, g0 = (c0 >> 8) & 255, b0 = c0 & 255;
  const r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255;
  const r = Math.round(r0 + (r1 - r0) * t);
  const g = Math.round(g0 + (g1 - g0) * t);
  const b = Math.round(b0 + (b1 - b0) * t);
  return `rgb(${r}, ${g}, ${b})`;
}