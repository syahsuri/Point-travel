# 0008 — Dotted destination trajectory line

**Date:** 2026-07-11
**Status:** done

## Goal

When a plane is selected, show a green dotted (or dashed) line stretching from the plane's current position to its destination airport (where it will land).

## What changed

| File | Change |
|------|--------|
| `app/components/FlightMap.tsx` | Added the `destination-path` source and `destination-line` layer inside map load handler. Updated `selectPlane(p)` to render the destination path immediately on selection. Updated the `animate` loop to update the destination path dynamically with the live position of the moving plane. Updated `deselectPlane` to clear the path. |
| `devlog/README.md` | Index entry for 0008. |

## Key decisions (and why)

- **Round Dots Implementation:** Combined `"line-cap": "round"` in layout with `"line-dasharray": [0.01, 2]` in paint to render clean, circular dots instead of standard dashes.
- **Dynamic Updates:** The path starts from the plane's live coordinates (`head`) in the animation loop. This prevents the dotted line from lagging behind the plane icon as the plane moves.

## Verify

```bash
npm run dev
npm run build
```
Expect:
- Clicking an active flight with a known destination draws a green dotted line from the plane's nose to the destination airport pin.
- The green dotted line moves smoothly along with the plane.
- De-selecting the plane removes the dotted line.
