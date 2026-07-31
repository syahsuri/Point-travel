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