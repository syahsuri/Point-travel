# 0003 — Place labels on the Dark basemap (country / province / city)

**Date:** 2026-07-06
**Status:** done

## Goal

The Dark map showed no region/area names. Add country, province, and city/town
labels so the dark basemap reads like a real map.

## Root cause (not a MapLibre version issue)

MapLibre draws text only when the style has **(a)** a `glyphs` font source and
**(b)** symbol layers with `text-field`. The Dark basemap had neither — it was
just country polygons. (Satellite = ESRI reference labels, Streets = OSM raster
labels already carried names.)

## What changed

| File | Change |
|------|--------|
| `app/components/FlightMap.tsx` | added `glyphs` (MapLibre demo endpoint), `places` + `provinces` sources, and 3 symbol layers: `country-labels`, `province-labels`, `city-labels`. Added them to the Dark visibility group only. |
| `public/data/id-places.geojson` | 105 Indonesian cities/towns (name + pop_max), filtered from Natural Earth `ne_10m_populated_places_simple`. |
| `public/data/id-provinces.geojson` | 33 Indonesian provinces as centroid points (name), reduced from Natural Earth `ne_10m_admin_1_states_provinces`. |
| `devlog/README.md` | index entry. |

## Key decisions (and why)

- **Glyphs = `https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf`** —
  free, no key. Verified fontstacks: **`Noto Sans Regular`** and
  **`Noto Sans Bold`** return 200; `Open Sans Regular` 404s (do not use it).
- **Labels are Dark-only** — added to `BASEMAP_LAYERS.dark` + `ALL_BASEMAP_LAYERS`
  so `setBasemap()` hides them on Satellite/Streets (which already label).
- **Provinces stored as centroid points**, not polygons — a small Node script
  averaged each polygon's coords. Keeps the file ~4.5 KB and labels sit near the
  region center. City text scales by `pop_max`; province/city layers have
  `minzoom` so they appear only when zoomed in (avoids clutter).

## Gotchas learned

- Not every fontstack exists on the demo endpoint — verify with a HEAD request
  before wiring it (`Open Sans Regular` is missing there).
- `glyphs` is external here (accepted trade-off). If it rate-limits or the app
  needs offline, self-host the PBFs under `public/fonts` and point `glyphs` there.
- Label layers are added in the initial style (before the on-`load` `planes`
  layer) so planes always draw on top.

## How to extend next

- Self-host glyphs for production reliability + offline.
- Tune label density (labelrank-based filter) if it gets crowded.

## Verify

```
npm run dev   # Dark map now shows country/province/city names
npm run build
```
Zoom in → provinces + cities appear; switch to Satellite/Streets → custom labels
hide; back to Dark → they return. Planes still on top + clickable.
