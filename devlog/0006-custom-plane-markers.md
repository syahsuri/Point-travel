# 0006 — Custom plane markers (plane-white.png & plane.png)

**Date:** 2026-07-11
**Status:** done

## Goal

Replace the character-based Nyan Cat styling (both the static `plane.svg` and animated `nyan-cat.gif`) with realistic plane icons: **`plane-white.png`** for default/unselected planes, and **`plane.png`** (blue) for the selected plane. Orient them correctly to align with their track heading.

## What changed

| File | Change |
|------|--------|
| `app/components/FlightMap.tsx` | Changed `PLANE_ICON_SRC` to `/icons/plane-white.png` and defined size constants. Added `SELECTED_PLANE_ICON_SRC` for `/icons/plane.png`. Removed `plane-flip` loading logic. Replaced `nyanMarkerRef` with `selectedMarkerRef` and updated the element creation to use `plane.png`. Updated layout rotation alignment and track offsets to face travel direction natively. |
| `devlog/README.md` | Index entry for 0006. |

## Key decisions (and why)

- **45° Rest Offset:** Both `plane-white.png` and `plane.png` point at 45° (North-East) at rest. To align them with their actual track heading, we rotate them by `track - 45` degrees.
- **Rotation Alignment:** Changed the symbol layer layout property `"icon-rotation-alignment"` to `"map"` instead of `"viewport"`. Since the markers are now actual planes (rather than side-profile characters that stay upright), aligning rotation with the map is standard and clean.
- **Removed Flipped Variant:** Side-profile characters needed horizontal mirroring (`plane-flip`) when westbound to avoid being upside-down. Top-down plane icons rotate naturally around 360°, so the flip layer was completely removed.

## Verify

```bash
npm run dev
npm run build
```
Expect:
- Unselected planes appear as white plane icons (`plane-white.png`) rotated along their track heading.
- Clicking a plane highlights it with the blue selected plane icon (`plane.png`), keeping correct rotation.
- De-selecting returns the plane to the white icon.
