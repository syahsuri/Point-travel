# 0002 — Basemap switcher (Dark / Satellite / Streets)

**Date:** 2026-07-06
**Status:** done

## Goal

Let the user change the map terrain like Google Maps: **Satellite** and
**Streets**, keeping the feature-001 **Dark** map as a third mode and the
default.

## What changed

| File | Change |
|------|--------|
| `app/components/FlightMap.tsx` | added 3 raster tile sources (ESRI imagery, ESRI reference, OSM) + 3 layers (hidden by default), a `Basemap` type + `setBasemap()` visibility toggle, `useState` for the active mode, and a 3-button switcher overlay. |
| `devlog/README.md` | index entry for 0002. |

## Key decisions (and why)

- **One style, toggle visibility — never `map.setStyle()`.** `setStyle` wipes
  custom sources/layers/images, which would drop the planes layer + icon on
  every switch. Instead all basemaps live in one style; switching flips
  `visibility` via `setLayoutProperty`. The `planes` symbol layer is added last
  and stays on top, untouched.
- **Free, no-key tiles:** ESRI World Imagery (satellite), ESRI Reference
  (hybrid labels: cities/borders/roads), OpenStreetMap (streets). No API key.
- **Dark stays default** — it is tile-free (local GeoJSON), so first paint is
  light. Raster tiles are only fetched when their mode is selected.

## Gotchas learned

- **Tile URL order differs:** ESRI is `{z}/{y}/{x}`, OSM is `{z}/{x}/{y}`.
  Swapping them silently loads wrong/blank tiles.
- Raster layers must sit **below** the `planes` layer so planes stay visible on
  imagery — layer order in the style handles this (planes added on `load`).
- `setLayoutProperty` throws before the style loads — `setBasemap` guards on
  `map.isStyleLoaded()`. Default mode needs no apply (dark layers ship visible).
- Source-level `attribution` strings (Esri, OSM) are auto-merged into the
  AttributionControl when those tiles load.

## How to extend next

- Persist the chosen basemap (localStorage) so it survives reload.
- Per-mode plane icon contrast (white icon can wash out on bright imagery).
- 3D terrain / hillshade is a separate future feature.

## Verify

```
npm run dev   # http://localhost:3000
npm run build
```
Click Dark / Satellite / Streets: Dark = original look; Satellite = imagery +
place labels; Streets = OSM roads. Planes visible + clickable in all three;
switching never drops them. No console errors; drag/zoom still work.
