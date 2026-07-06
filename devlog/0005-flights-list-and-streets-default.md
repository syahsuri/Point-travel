# 0005 — Floating flights list, custom plane icon, Streets default

**Date:** 2026-07-06
**Status:** done

## What changed

| File | Change |
|------|--------|
| `app/components/FlightMap.tsx` | lifted planes into React state (`planeList`); added a floating **Flights** panel (top-right, collapsible) listing each plane, click → `flyTo` + popup; swapped the plane marker to `public/icons/plane.svg`; made **Streets** the default basemap and reordered the switcher to Streets · Dark · Satellite. |
| `public/icons/plane.svg` | new marker art (user-supplied). |

## Notes / decisions

- **List needs React state.** Plane data previously lived only in the MapLibre
  GeoJSON source. Now `loadPlanes()` results are stored in `planeList` (set on
  initial load and on every poll) so the list re-renders live alongside the map.
- **List UX:** sorted airborne-first then by callsign; green dot = airborne,
  gray = on ground; row shows callsign + altitude/speed; header shows count and
  toggles open/closed.
- **Icon:** loaded from `/icons/plane.svg` via `map.addImage`. `icon-rotate` =
  `track + PLANE_ICON_ROTATE_OFFSET`; set the offset (`-90/90/180`) if the art's
  nose isn't pointing north at rest.
- **Streets default:** style still ships with dark layers visible; `map.on("load")`
  calls `setBasemap(map, "streets")` to flip to the default once loaded.

## How to extend next

- Search/filter box on the list; filter to airborne only.
- Highlight the list row for the currently selected plane.
- Smooth interpolation between polls (still open from 0004).

## Verify

`npm run dev` → opens on Streets; top-right Flights panel lists ~100 planes;
click a row flies the map there; basemap switch + labels + polling still work.
`npm run build` OK.
