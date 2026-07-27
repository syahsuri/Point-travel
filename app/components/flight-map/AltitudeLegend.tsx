"use client";

import { ALTITUDE_COLOR_STOPS } from "@/lib/altitudeColor";

type AltitudeLegendProps = {
  visible: boolean;
  /** The currently selected plane's barometric altitude in meters, or null. */
  selectedAltitude?: number | null;
};

/**
 * Horizontal altitude color-scale legend, shown only while altitude
 * coloring is active. Left = ground level, right = high altitude.
 * Positioned bottom-center, just above the attribution footer.
 * When a plane is selected, an arrow marker indicates its altitude on the bar.
 */
export default function AltitudeLegend({
  visible,
  selectedAltitude,
}: AltitudeLegendProps) {
  if (!visible) return null;

  const maxAlt = ALTITUDE_COLOR_STOPS[ALTITUDE_COLOR_STOPS.length - 1][0];
  const gradientStops = ALTITUDE_COLOR_STOPS.map(
    ([alt, color]) => `${color} ${(alt / maxAlt) * 100}%`
  ).join(", ");

  // Compute arrow position as a percentage (clamped 0–100).
  const hasAlt =
    typeof selectedAltitude === "number" && selectedAltitude >= 0;
  const arrowPct = hasAlt
    ? Math.min(100, Math.max(0, (selectedAltitude / maxAlt) * 100))
    : null;

  return (
    <div className="pointer-events-none absolute bottom-7 left-1/2 z-10 -translate-x-1/2 flex flex-col items-center gap-1">
      {/* Arrow indicator for selected plane */}
      <div className="relative w-[26rem] md:w-[34rem] h-4">
        {arrowPct !== null && (
          <div
            className="absolute -top-0.5 transition-all duration-300 ease-out"
            style={{ left: `${arrowPct}%`, transform: "translateX(-50%)" }}
          >
            <svg
              width="12"
              height="14"
              viewBox="0 0 12 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6 14L1 6H11L6 14Z"
                fill="white"
                stroke="black"
                strokeWidth="0.8"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Gradient bar with tick marks */}
      <div
        className="relative w-[26rem] md:w-[34rem] h-2.5 border border-white/25"
        style={{
          background: `linear-gradient(to right, ${gradientStops})`,
        }}
      >
        {ALTITUDE_COLOR_STOPS.slice(1).map(([alt]) => {
          const pct = (alt / maxAlt) * 100;
          return (
            <div
              key={alt}
              className="absolute top-0 h-full w-px bg-black/30"
              style={{ left: `${pct}%` }}
            />
          );
        })}
      </div>

      {/* Number labels */}
      <div className="relative w-[26rem] md:w-[34rem] h-3">
        {ALTITUDE_COLOR_STOPS.map(([alt]) => {
          const pct = (alt / maxAlt) * 100;
          return (
            <span
              key={alt}
              className="absolute text-[7px] md:text-[8px] font-medium text-white/60 leading-none"
              style={{
                left: `${pct}%`,
                transform: "translateX(-50%)",
              }}
            >
              {alt}
            </span>
          );
        })}
      </div>
    </div>
  );
}