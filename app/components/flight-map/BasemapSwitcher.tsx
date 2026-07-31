"use client";

import type { Basemap } from "@/lib/mapConstants";

type BasemapSwitcherProps = {
  basemap: Basemap;
  onSelectBasemap: (mode: Basemap) => void;
  showPlanes: boolean;
  onTogglePlanes: () => void;
  showAirports: boolean;
  onToggleAirports: () => void;
  showAltitudeColors: boolean;
  onToggleAltitudeColors: () => void;
};

const MODES: { id: Basemap; label: string }[] = [
  { id: "satellite", label: "Satellite" },
  { id: "streets", label: "Streets" },
  { id: "dark", label: "Dark" },
];

export default function BasemapSwitcher({
  basemap,
  onSelectBasemap,
  showPlanes,
  onTogglePlanes,
  showAirports,
  onToggleAirports,
  showAltitudeColors,
  onToggleAltitudeColors,
}: BasemapSwitcherProps) {
  return (
    <div className="absolute left-2 top-2 md:left-4 md:top-4 z-10 flex items-stretch overflow-hidden rounded-lg border border-white/10 bg-black/60 text-[10px] md:text-xs font-medium backdrop-blur shadow-lg select-none">
      {/* ── Basemap modes (single-select) ── */}
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onSelectBasemap(m.id)}
          title={`Switch to ${m.label}`}
          className={`px-2.5 py-2 md:px-3 transition-colors ${
            basemap === m.id
              ? "bg-white/90 text-black"
              : "text-white/80 hover:bg-white/10"
          }`}
        >
          {m.label}
        </button>
      ))}

      {/* Visual separator: modes vs. toggles */}
      <div className="w-px bg-white/10 my-1.5" />

      {/* ── Feature toggles (on/off switches) ── */}
      <button
        type="button"
        onClick={onTogglePlanes}
        title={showPlanes ? "Hide planes" : "Show planes"}
        aria-label="Toggle planes"
        aria-pressed={showPlanes}
        className={`px-2.5 py-2 md:px-3 transition-colors ${
          showPlanes
            ? "text-sky-400 bg-sky-500/15"
            : "text-white/60 hover:bg-white/5 hover:text-white"
        }`}
      >
        ✈
      </button>

      <button
        type="button"
        onClick={onToggleAirports}
        title={showAirports ? "Hide airports" : "Show airports"}
        aria-label="Toggle airports"
        aria-pressed={showAirports}
        className={`px-2.5 py-2 md:px-3 transition-colors ${
          showAirports
            ? "text-sky-400 bg-sky-500/15"
            : "text-white/60 hover:bg-white/5 hover:text-white"
        }`}
      >
        🏢
      </button>

      <button
        type="button"
        onClick={onToggleAltitudeColors}
        title={showAltitudeColors ? "Disable altitude colors" : "Color by altitude"}
        aria-label="Toggle altitude colors"
        aria-pressed={showAltitudeColors}
        className={`px-2.5 py-2 md:px-3 transition-colors ${
          showAltitudeColors
            ? "text-sky-400 bg-sky-500/15"
            : "text-white/60 hover:bg-white/5 hover:text-white"
        }`}
      >
        🎨
      </button>
    </div>
  );
}