"use client";

import { ALTITUDE_COLOR_STOPS } from "@/lib/altitudeColor";

type AltitudeLegendProps = {
  visible: boolean;
};

/**
 * Vertical altitude color-scale legend, shown only while altitude
 * coloring is active. Bottom = ground level, top = high altitude.
 * Positioned bottom-right, just above the attribution footer.
 */
export default function AltitudeLegend({ visible }: AltitudeLegendProps) {
  if (!visible) return null;

  const maxAlt = ALTITUDE_COLOR_STOPS[ALTITUDE_COLOR_STOPS.length - 1][0];
  const gradientStops = ALTITUDE_COLOR_STOPS.map(
    ([alt, color]) => `${color} ${(alt / maxAlt) * 100}%`
  ).join(", ");

  return (
    <div className="pointer-events-none absolute bottom-8 right-3 z-10 flex items-end gap-1.5">
      <div className="flex flex-col items-end justify-between text-[8px] font-medium text-white/70" style={{ height: "10rem" }}>
        {[...ALTITUDE_COLOR_STOPS].reverse().map(([alt]) => (
          <span key={alt} className="leading-none">
            {alt}
          </span>
        ))}
      </div>
      <div
        className="w-2 rounded-full border border-white/20"
        style={{
          height: "10rem",
          background: `linear-gradient(to top, ${gradientStops})`,
        }}
      />
    </div>
  );
}