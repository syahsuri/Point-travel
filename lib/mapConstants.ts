export type Basemap = "dark" | "satellite" | "streets";

// Indonesia bounding box [west, south, east, north] — keeps the initial view
// (and the data we care about) scoped small.
export const INDONESIA_BOUNDS: [number, number, number, number] = [
  94, -11, 141, 7,
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

export const PLANE_ICON_SRC = "/icons/plane.png";
export const PLANE_ICON_W = 40;
export const PLANE_ICON_H = 40;

export const SELECTED_PLANE_ICON_SRC = "/icons/plane-white.png";
export const SELECTED_PLANE_ICON_W = 40;
export const SELECTED_PLANE_ICON_H = 40;