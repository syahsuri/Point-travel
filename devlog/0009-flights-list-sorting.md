# 0009 — Flights List Sorting (Asc/Desc by position update time)

**Date:** 2026-07-11
**Status:** done

## Goal

Add a toggle button inside the Flights sidebar list to sort planes ascending or descending based on their last-known position update time (`last_time_position`), showing the most recently updated flight first by default.

## What changed

| File | Change |
|------|--------|
| `app/components/FlightMap.tsx` | Added `sortDesc` component state. Integrated a sort-order toggle button styled with `🕒` icon next to the search input field. Updated the sort comparator of `filteredPlanes` to use `posSecs` values and sort according to `sortDesc`. |
| `devlog/README.md` | Index entry for 0009. |

## Key decisions (and why)

- **Default Sort Order:** Default is set to descending (`sortDesc = true`) so that "most updated minute data first" is rendered on initial load.
- **Unified Controls Layout:** Placed the sorting toggle directly adjacent to the search input inside a flex row. This saves space and keeps all filtering/sorting controls visually grouped together.
- **Robust Comparator:** Used the parsed `posSecs` unix seconds values for numerical subtraction, falling back to callsign alphabetical comparison in case of matching/invalid timestamps.

## Verify

```bash
npm run dev
npm run build
```
Expect:
- Flights sidebar list renders flights sorted with the newest position updates first.
- Clicking the `🕒` button flips the sort order arrow and reverses the sorting list (oldest updates first).
