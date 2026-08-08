"use client";

import { ALTITUDE_COLOR_STOPS } from "@/lib/altitudeColor";

type AltitudeLegendProps = {
  visible: boolean;
  /** The currently selected plane's barometric altitude in meters, or null. */
  selectedAltitude?: number | null;
  mapInteracting?: boolean;
};

/**
 * Altitude color-scale legend.
 * On mobile (< md): a slim vertical bar, bounds only (top/bottom), with the
 * selected plane's altitude called out as a floating number next to the
 * arrow — simplified from the earlier version, which packed in a tick
 * ladder (6 labels + lines) that felt crowded on a narrow column.
 * On desktop (>= md): unchanged — detailed horizontal bar, bottom center.
 */
export default function AltitudeLegend({
  visible,
  selectedAltitude,
  mapInteracting = false,
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

  const altLabel = hasAlt
    ? selectedAltitude >= 1000
      ? `${(selectedAltitude / 1000).toFixed(1).replace(/\.0$/, "")}k`
      : `${Math.round(selectedAltitude)}`
    : null;

  return (
    <>
      {/* ---------------- MOBILE VERTICAL LEGEND (< md) ---------------- */}
      <div
        className={`md:hidden pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 flex flex-col items-center gap-1 rounded-full border border-white/15 bg-black/70 px-2 py-3 backdrop-blur-md shadow-xl transition-all duration-300 ease-out ${mapInteracting ? "-translate-x-12 opacity-0" : "translate-x-0 opacity-100"
          }`}
      >
        {/* Top bound */}
        <span className="text-[7px] font-semibold text-white/50 leading-none">
          {maxAlt / 1000}k
        </span>

        <div className="relative flex items-center">
          {/* Gradient bar */}
          <div className="relative h-40 w-2 rounded-full ring-1 ring-white/20">
            <div
              className="h-full w-full rounded-full"
              style={{ background: `linear-gradient(to top, ${gradientStops})` }}
            />

            {arrowPct !== null && (
              <>
                {/* Dot: centered exactly on the bar, small */}
                <div
                  className="pointer-events-none absolute inset-x-0 flex justify-center"
                  style={{ top: `${100 - arrowPct}%`, transform: "translateY(-50%)" }}
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-white ring-1 ring-black/70 shadow" />
                </div>

                {/* Label: sits outside the bar, to the right */}
                <span
                  className="absolute whitespace-nowrap text-[9px] font-mono font-bold text-white leading-none"
                  style={{
                    top: `${100 - arrowPct}%`,
                    left: "100%",
                    marginLeft: "14px",
                    transform: "translateY(-50%)",
                    WebkitTextStroke: "2px rgba(0,0,0,0.9)",
                    paintOrder: "stroke fill",
                  }}
                >
                  {altLabel}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Bottom bound */}
        <span className="text-[7px] font-semibold text-white/50 leading-none">
          0
        </span>
      </div>

      {/* ---------------- DESKTOP HORIZONTAL LEGEND (>= md) — unchanged ---------------- */}
      <div className="hidden md:flex pointer-events-none absolute bottom-1 left-1/2 z-10 -translate-x-1/2 flex-col items-center gap-1.5 rounded-lg border border-white/15 bg-black/60 px-4 pb-2.5 pt-3 backdrop-blur-md shadow-lg">
        <div className="flex w-136 items-center justify-between text-[9px] font-semibold uppercase tracking-widest text-white/50">
          <span>Ground</span>
          <span className="text-white/70">Altitude</span>
          <span>{maxAlt.toLocaleString("en-US")}m+</span>
        </div>

        <div className="relative w-136 h-4">
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

        <div
          className="relative w-136 h-3 rounded-full ring-1 ring-white/25 shadow-inner"
          style={{
            background: `linear-gradient(to right, ${gradientStops})`,
          }}
        >
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

        <div className="relative w-136 h-3">
          {ALTITUDE_COLOR_STOPS.map(([alt]) => {
            const pct = (alt / maxAlt) * 100;
            return (
              <span
                key={alt}
                className="absolute text-[8px] font-semibold text-white leading-none"
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
    </>
  );
}