# 0007 — Swapped plane marker roles & added black border to blue plane

**Date:** 2026-07-11
**Status:** done

## Goal

Swap the roles of the plane icons so that:
- Unselected/default planes are blue (`plane.png`).
- Selected planes turn white (`plane-white.png`).
Also, add a black border to the blue plane icon so that it stands out cleanly on all map backgrounds (especially light-themed streets and satellite styles).

## What changed

| File | Change |
|------|--------|
| `public/icons/plane.png` | Updated the binary asset to add a black outline using PIL (Python script). |
| `app/components/FlightMap.tsx` | Swapped the paths: `PLANE_ICON_SRC` now uses `/icons/plane.png` and `SELECTED_PLANE_ICON_SRC` uses `/icons/plane-white.png`. |
| `devlog/README.md` | Index entry for 0007. |

## Key decisions (and why)

- **Outline Generation:** Used Python's PIL library (`ImageFilter.MaxFilter`) to programmatically expand the alpha mask of the original blue plane icon and composite a black outline underneath it. This matches the black stroke style of `plane-white.png`.
- **Role Swap:** Reversing the colors makes the majority of planes blue (standard for several flight tracking UIs) and highlights the currently selected plane in a clean white outline.

## Verify

```bash
npm run dev
npm run build
```
Expect:
- Unselected planes are blue with a black outline (`plane.png`).
- The selected plane turns white with a black outline (`plane-white.png`).
- Rotation offset (45°) and size (40x40px) remain correct and aligned.
