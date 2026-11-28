"use client";

import { ALTITUDE_COLOR_STOPS, GROUND_COLOR } from "@/lib/altitudeColor";

type AltitudeLegendProps = {
  visible: boolean;
  /** The currently selected plane's barometric altitude in meters, or null. */
  selectedAltitude?: number | null;
  mapInteracting?: boolean;
};

const MAX_FT = ALTITUDE_COLOR_STOPS[ALTITUDE_COLOR_STOPS.length - 1][0];
const TICKS = [0, 10000, 20000, 30000, MAX_FT];

/**
 * Compact altitude color-scale legend (feet). Lives in the bottom-right
 * stack above the attribution; on mobile it fades out while the map moves.
 */
export default function AltitudeLegend({
  visible,
  selectedAltitude,
  mapInteracting = false,
}: AltitudeLegendProps) {
  if (!visible) return null;

  const gradientStops = ALTITUDE_COLOR_STOPS.map(
    ([ft, color]) => `${color} ${(ft / MAX_FT) * 100}%`
  ).join(", ");

  const selectedFt =
    typeof selectedAltitude === "number" && selectedAltitude >= 0
      ? selectedAltitude * 3.28084
      : null;
  const arrowPct =
    selectedFt !== null ? Math.min(100, (selectedFt / MAX_FT) * 100) : null;

  return (
    <div
      className={`rounded-lg border border-white/10 bg-black/60 px-3 pb-1.5 pt-2 backdrop-blur-md shadow-lg transition-opacity duration-300 ${mapInteracting ? "max-md:opacity-0" : "opacity-100"
        }`}
    >
      <div className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-wider text-white/55">
        <span>Altitude (ft)</span>
        {selectedFt !== null ? (
          <span className="font-mono normal-case tracking-normal text-white">
            {Math.round(selectedFt).toLocaleString("en-US")} ft
          </span>
        ) : (
          <span className="flex items-center gap-1 normal-case tracking-normal">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: GROUND_COLOR }}
            />
            On ground
          </span>
        )}
      </div>

      <div className="relative mt-1.5">
        <div
          className="h-2 rounded-full ring-1 ring-white/20"
          style={{ background: `linear-gradient(to right, ${gradientStops})` }}
        />
        {arrowPct !== null && (
          <div
            className="absolute top-1/2 h-3.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-1 ring-black/70 transition-all duration-300"
            style={{ left: `${arrowPct}%` }}
          />
        )}
      </div>

      <div className="relative mt-1 h-3 text-[9px] font-medium text-white/60">
        {TICKS.map((ft, i) => (
          <span
            key={ft}
            className="absolute"
            style={{
              left: `${(ft / MAX_FT) * 100}%`,
              transform:
                i === 0 ? "none" : i === TICKS.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {ft === 0 ? "0" : `${ft / 1000}k${ft === MAX_FT ? "+" : ""}`}
          </span>
        ))}
      </div>
    </div>
  );
}
