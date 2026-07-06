# 0001 — World map + static plane markers (Indonesia)

**Date:** 2026-07-06
**Status:** done (frontend-only; real backend not wired yet)

## Goal

First slice of a FlightRadar24-style app: a full-screen dark map showing plane
icons at fixed positions, scoped to Indonesia to keep memory small. Data is
**static** for now — the real backend is being built separately.

## What changed

| File | Purpose |
|------|---------|
| `package.json` | added `maplibre-gl` (WebGL map renderer, BSD-3). |
| `public/data/world-110m.geojson` | Natural Earth 1:110m countries (public domain) — the land polygons. ~820 KB, coarse = light. |
| `public/data/planes-indonesia.json` | 20 mock planes over Indonesia, in OpenSky state-vector shape. |
| `lib/types.ts` | `StateVector` type mirroring OpenSky fields. |
| `lib/planes.ts` | `loadPlanes()` — the ONE place that knows where data comes from. |
| `app/components/FlightMap.tsx` | `'use client'` MapLibre map: dark sea + land, planes as a WebGL symbol layer rotated by heading, click popup. |
| `app/page.tsx` | renders `<FlightMap />` + a corner label. |
| `app/layout.tsx` | title/metadata → `point-travel`. |
| `app/globals.css` | imports MapLibre CSS, makes the map fill the viewport, dark popup styling. |

## Key decisions (and why)

- **MapLibre GL (raw), not react-map-gl** — WebGL symbol layers scale to
  thousands of planes and rotating an icon by heading is one line
  (`icon-rotate: ['get','track']`). Raw usage avoids React 19 / Next 16
  peer-dependency risk from the wrapper.
- **No map tiles** — the basemap is a local GeoJSON drawn as polygons. Zero API
  keys, zero rate limits, lowest memory, and the dark FR24 look. Sea = a
  `background` layer, land = a `fill` layer.
- **OpenSky data shape** — the mock JSON already uses the fields the real
  backend/OpenSky return, so going live later changes only `lib/planes.ts`.
- **Plane icon is an inline SVG** in `FlightMap.tsx` (points north at rest, so
  `true_track` maps straight to `icon-rotate`). Kept inline = single source of
  truth, no extra fetch to fail. Rendered to a raster via `map.addImage`.

## Gotchas learned

- MapLibre must run client-side only: `'use client'` + create the map inside
  `useEffect`, and `map.remove()` on cleanup or you leak WebGL contexts.
- A symbol layer needs its icon loaded (`map.addImage`) **before** `addLayer`;
  we load the SVG via an `Image`, then add source + layer in its `onload`.
- `body { overflow: hidden }` so the full-viewport map doesn't create scrollbars.

## How to extend next

1. **Live data:** change `STATIC_SOURCE` in `lib/planes.ts` to the backend URL.
   No UI change needed as long as the response matches `StatesResponse`.
2. **Polling / animation:** add `setInterval(loadPlanes)` in `FlightMap` and call
   `(map.getSource('planes') as GeoJSONSource).setData(planesToGeoJSON(...))` —
   the source is already a GeoJSON source built for this.
3. **Click-to-detail panel, search/filter, trails, wider than Indonesia** — later
   features, each its own devlog entry.

## Verify

```
npm run dev   # open http://localhost:3000
npm run build # must succeed (map is client-only, no SSR crash)
```
Expect: dark map centered on Indonesia, plane icons at Jakarta/Surabaya/Bali/
Medan/Makassar/enroute, rotated by heading; clicking one shows callsign + alt/spd.
