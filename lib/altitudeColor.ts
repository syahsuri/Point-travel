import type { ExpressionSpecification } from "maplibre-gl";

// Altitude (meters) -> color stops, roughly matching a rainbow "hypsometric"
// scale: red/orange near ground, up through yellow/green/cyan, to blue/violet
// at cruise altitude, capping at magenta for very high altitude.
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

const GROUND_COLOR = "#8a8f98"; // neutral gray for on-ground / unknown altitude

/**
 * MapLibre paint expression: colors a feature by its `baro_altitude`
 * property (meters), falling back to a neutral gray when altitude is
 * missing/null (e.g. aircraft on the ground).
 */
export function altitudeColorExpression(): ExpressionSpecification {
  const stops = ALTITUDE_COLOR_STOPS.flatMap(([alt, color]) => [alt, color]);
  return [
    "case",
    ["<", ["coalesce", ["get", "baro_altitude"], -1], 0],
    GROUND_COLOR,
    ["interpolate", ["linear"], ["get", "baro_altitude"], ...stops],
  ] as unknown as ExpressionSpecification;
}