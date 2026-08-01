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
    <div className="pointer-events-none absolute bottom-1 left-1/2 z-10 -translate-x-1/2 flex flex-col items-center gap-1.5 rounded-lg border border-white/15 bg-black/55 px-4 pb-2.5 pt-3 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
      {/* Tiny label header */}
      <div className="flex w-full items-center justify-between text-[8px] md:text-[9px] font-semibold uppercase tracking-widest text-white/50">
        <span>Ground</span>
        <span className="text-white/70">Altitude</span>
        <span>{maxAlt.toLocaleString("en-US")}m+</span>
      </div>

      {/* Arrow indicator for selected plane */}
      <div className="relative w-104 md:w-136 h-4">
        {arrowPct !== null && (
          <div
            className="absolute -top-0.5 transition-all duration-300 ease-out"
            style={{ left: `${arrowPct}%`, transform: "translateX(-50%)" }}
          >
            <svg
              width="14"
              height="16"
              viewBox="0 0 12 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}
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

      {/* Gradient bar with tick marks — glowing edge + inner sheen */}
      <div
        className="relative w-104 md:w-136 h-3 rounded-full ring-1 ring-white/25 shadow-[0_0_10px_rgba(255,255,255,0.15)]"
        style={{
          background: `linear-gradient(to right, ${gradientStops})`,
        }}
      >
        {/* subtle glass sheen across the top half */}
        <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-white/15" />

        {ALTITUDE_COLOR_STOPS.slice(1, -1).map(([alt]) => {
          const pct = (alt / maxAlt) * 100;
          return (
            <div
              key={alt}
              className="absolute top-0 h-full w-px bg-black/25"
              style={{ left: `${pct}%` }}
            />
          );
        })}
      </div>

      {/* Number labels — dark stroke so they stay legible over any color */}
      <div className="relative w-104 md:w-136 h-3">
        {ALTITUDE_COLOR_STOPS.map(([alt]) => {
          const pct = (alt / maxAlt) * 100;
          return (
            <span
              key={alt}
              className="absolute text-[7px] md:text-[8px] font-semibold text-white leading-none"
              style={{
                left: `${pct}%`,
                transform: "translateX(-50%)",
                WebkitTextStroke: "2px rgba(0,0,0,0.85)",
                paintOrder: "stroke fill",
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