import type { ExpressionSpecification } from "maplibre-gl";

export type Basemap = "dark" | "satellite" | "streets";

// `planes` layer icon size by zoom. Shared with chaos mode so leaving it
// restores exactly the size the engine set.
export const PLANE_ICON_SIZE: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  4,
  0.33,
  7,
  0.48,
  10,
  0.63,
  13,
  0.78,
];

// Indonesia bounding box [west, south, east, north] — keeps the initial view
// (and the data we care about) scoped small.
export const INDONESIA_BOUNDS: [number, number, number, number] = [
  94, -11, 141, 7,
];
// Phones: Sumatra–Bali incl. KL/SG, where most traffic is. All of Indonesia
// in portrait is a thin strip between China and Australia.
export const WEST_INDONESIA_BOUNDS: [number, number, number, number] = [
  94, -9, 117, 6,
];
export const ASEAN_BOUNDS: [number, number, number, number] = [
  92, -20, 141, 29,
];

// Konami code easter egg sequence (↑↑↓↓←→←→BA) that triggers chaos mode.
export const KONAMI_CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

export const DEFAULT_PLANE_COLOR = "#2754A5";

// Airport markers: large airports (OurAirports "large_airport") at every zoom,
// the rest only from zoom 6 so the country view isn't buried in icons.
export const AIRPORT_ZOOM_FILTER: ExpressionSpecification = [
  "any",
  ["==", ["get", "type"], "large_airport"],
  [">=", ["zoom"], 6],
];

export const SELECTED_PLANE_ICON_SRC = "/icons/plane-white.png";
export const SELECTED_PLANE_ICON_W = 40;
export const SELECTED_PLANE_ICON_H = 40;