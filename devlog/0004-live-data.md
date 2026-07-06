# 0004 — Live plane data from backend + polling

**Date:** 2026-07-06
**Status:** done

## Goal

Replace the static mock planes with the real backend
(`https://flights.gukgukcraft.id/flights`) and refresh positions on a timer.
This is the swap feature 001 was designed for.

## What changed

| File | Change |
|------|--------|
| `app/api/planes/route.ts` (new) | server-side proxy: fetches the backend, normalizes to `{ time, states }`, drops invalid entries, trims callsigns. |
| `lib/planes.ts` | `loadPlanes()` now hits `/api/planes` instead of the static JSON. Only data-source line changed; return type unchanged. |
| `app/components/FlightMap.tsx` | added a 2-min poll that calls `loadPlanes()` and `source.setData(...)` in place; `clearInterval` on unmount. Imported `GeoJSONSource`. |
| `devlog/README.md` | index entry. |

## Key decisions (and why)

- **Proxy route is required, not optional.** The backend sends **no CORS
  header** (Cloudflare), so a browser `fetch` would be blocked. `/api/planes`
  runs server-side (Vercel), so no CORS; it also hides any future key and lets
  us edge-cache (`Cache-Control: s-maxage=60, swr=120`).
- **Tolerant parser.** Backend returns a **bare array** (confirmed by request);
  the route also accepts a `{ states }` envelope and filters entries missing
  `icao24`/`longitude`/`latitude` (the empty `{}` objects in the sample).
- **Poll every 2 min** for 5-min data — catches updates soon without hammering.
- **Jump on update** — `setData` moves planes to new positions each poll.
  Smooth interpolation is a later feature.
- **Fail soft** — a failed backend fetch returns empty (route) / logs and keeps
  last-known planes (client), so the map never goes blank on a blip.

## Fields

Backend fields already match `StateVector` (`lib/types.ts`) — `icao24, callsign,
origin_country, longitude, latitude, baro_altitude, geo_altitude, on_ground,
velocity, true_track`. Extras (`vertical_rate, squawk, ...`) are ignored.

## Config

`FLIGHTS_API_URL` env var overrides the backend URL; falls back to the hardcoded
one, so no env setup is required (locally or on Vercel).

## How to extend next

- Smooth interpolation / dead-reckoning between updates (glide, not jump).
- "Updated Xm ago" indicator using the `time` field.
- Retry/backoff + a small offline badge.

## Verify

```
npm run dev
curl http://localhost:3000/api/planes   # { time, states:[100] }, 0 invalid
```
Map shows ~100 live planes; leaving it open ≥2 min refreshes positions with no
reload. `npm run build` OK. On Vercel, `/api/planes` works (server bypasses CORS).
