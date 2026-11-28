import type { ExpressionSpecification } from "maplibre-gl";

const M_TO_FT = 3.28084;

/**
 * Altitude (feet) → plane color. One hue (amber), dim when low, brightest at
 * cruise; amber stands out on both the dark map and blue sea on satellite.
 * Previous 3-hue scale: #fb923c / #fde047 / #22d3ee at 0 / 10k / 40k ft.
 */
export const ALTITUDE_COLOR_STOPS: [number, string][] = [
  [0, "#b45309"],
  [10000, "#f59e0b"],
  [40000, "#fde68a"],
];

/** On the ground, landed, or altitude unknown. */
export const GROUND_COLOR = "#8a8f98";

export function altitudeColorExpression(): ExpressionSpecification {
  const stops = ALTITUDE_COLOR_STOPS.flatMap(([alt, color]) => [alt, color]);
  return [
    "case",
    [
      "any",
      ["==", ["get", "flight_status"], "Landed"],
      ["==", ["get", "on_ground"], true],
      // baro_altitude is null for some reports; interpolate would warn on null.
      ["!=", ["typeof", ["get", "baro_altitude"]], "number"],
    ],
    GROUND_COLOR,
    [
      "interpolate",
      ["linear"],
      ["*", ["get", "baro_altitude"], M_TO_FT],
      ...stops,
    ],
  ] as unknown as ExpressionSpecification;
}
