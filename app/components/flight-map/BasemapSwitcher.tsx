"use client";

import type { Basemap } from "@/lib/mapConstants";

type BasemapSwitcherProps = {
  basemap: Basemap;
  onSelectBasemap: (mode: Basemap) => void;
  showPlanes: boolean;
  onTogglePlanes: () => void;
  showAirports: boolean;
  onToggleAirports: () => void;
};

const MODES: { id: Basemap; label: string }[] = [
  { id: "streets", label: "Streets" },
  { id: "dark", label: "Dark" },
  { id: "satellite", label: "Satellite" },
];

/**
 * Top-left control bar: basemap switcher (Streets/Dark/Satellite) plus
 * Planes/Airports visibility toggles, all in one pill-shaped row.
 */
export default function BasemapSwitcher({
  basemap,
  onSelectBasemap,
  showPlanes,
  onTogglePlanes,
  showAirports,
  onToggleAirports,
}: BasemapSwitcherProps) {
  return (
    <div className="absolute left-4 top-4 z-10 flex overflow-hidden rounded-md border border-white/10 bg-black/50 text-xs font-medium backdrop-blur">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onSelectBasemap(m.id)}
          className={`px-3 py-1.5 transition-colors ${
            basemap === m.id
              ? "bg-white/90 text-black"
              : "text-white/80 hover:bg-white/10"
          }`}
        >
          {m.label}
        </button>
      ))}

      <button
        type="button"
        onClick={onTogglePlanes}
        className={`px-3 py-1.5 transition-colors ${
          showPlanes
            ? "bg-white/90 text-black"
            : "text-white/80 hover:bg-white/10"
        }`}
      >
        ✈
      </button>
      <button
        type="button"
        onClick={onToggleAirports}
        className={`px-3 py-1.5 transition-colors ${
          showAirports
            ? "bg-white/90 text-black"
            : "text-white/80 hover:bg-white/10"
        }`}
      >
        🏢
      </button>
    </div>
  );
}