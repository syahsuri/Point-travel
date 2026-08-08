"use client";

import { useEffect, useRef, useState } from "react";
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
  onOpenChange?: (open: boolean) => void;
  onOpen?: () => void;
};

const MODES: { id: Basemap; label: string }[] = [
  { id: "satellite", label: "Satellite" },
  { id: "streets", label: "Streets" },
  { id: "dark", label: "Dark" },
];

/**
 * Map settings control: a single gear button that opens a dropdown panel
 * containing basemap mode selection + feature toggles (planes, airports,
 * altitude coloring). Collapsed by default so it doesn't compete for space
 * with the other floating HUD elements; closes on outside click or Escape.
 */
export default function BasemapSwitcher({
  basemap,
  onSelectBasemap,
  showPlanes,
  onTogglePlanes,
  showAirports,
  onToggleAirports,
  showAltitudeColors,
  onToggleAltitudeColors,
  onOpenChange,
  onOpen,
}: BasemapSwitcherProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function toggleOpen() {
    const next = !open;
    if (next) onOpen?.();
    onOpenChange?.(next);
    setOpen(next);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        onOpenChange?.(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        onOpenChange?.(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  return (
    <div
      ref={containerRef}
      className="absolute left-2 top-2 md:left-4 md:top-4 z-10 select-none"
    >
      {/* Gear trigger */}
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-label="Map settings"
        title="Map settings"
        className={`flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-lg border backdrop-blur shadow-lg text-base md:text-lg transition-colors ${open
            ? "border-sky-400/40 bg-sky-500/20 text-white"
            : "border-white/10 bg-black/60 text-white/80 hover:bg-white/10"
          }`}
      >
        ⚙️
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 top-full mt-2 w-56 overflow-hidden rounded-lg border border-white/10 bg-black/80 text-xs font-medium backdrop-blur shadow-xl">
          {/* Basemap modes */}
          <div className="px-3 pt-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">
            Basemap
          </div>
          <div className="flex flex-col px-1.5 pb-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectBasemap(m.id)}
                className={`flex items-center justify-between rounded px-2.5 py-1.5 text-left transition-colors ${basemap === m.id
                    ? "bg-white/90 text-black"
                    : "text-white/80 hover:bg-white/10"
                  }`}
              >
                <span>{m.label}</span>
                {basemap === m.id && <span className="text-[11px]">✓</span>}
              </button>
            ))}
          </div>

          <div className="h-px bg-white/10" />

          {/* Feature toggles */}
          <div className="px-3 pt-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">
            Layers
          </div>
          <div className="flex flex-col px-1.5 pb-2">
            <button
              type="button"
              onClick={onTogglePlanes}
              aria-pressed={showPlanes}
              className="flex items-center justify-between rounded px-2.5 py-1.5 text-left text-white/80 hover:bg-white/10 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span>✈</span>
                <span>Planes</span>
              </span>
              <span
                className={`h-4 w-7 shrink-0 rounded-full transition-colors relative ${showPlanes ? "bg-sky-500" : "bg-white/15"
                  }`}
              >
                <span
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${showPlanes ? "translate-x-3.5" : "translate-x-0.5"
                    }`}
                />
              </span>
            </button>

            <button
              type="button"
              onClick={onToggleAirports}
              aria-pressed={showAirports}
              className="flex items-center justify-between rounded px-2.5 py-1.5 text-left text-white/80 hover:bg-white/10 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span>🏢</span>
                <span>Airports</span>
              </span>
              <span
                className={`h-4 w-7 shrink-0 rounded-full transition-colors relative ${showAirports ? "bg-sky-500" : "bg-white/15"
                  }`}
              >
                <span
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${showAirports ? "translate-x-3.5" : "translate-x-0.5"
                    }`}
                />
              </span>
            </button>

            <button
              type="button"
              onClick={onToggleAltitudeColors}
              aria-pressed={showAltitudeColors}
              className="flex items-center justify-between rounded px-2.5 py-1.5 text-left text-white/80 hover:bg-white/10 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span>🎨</span>
                <span>Altitude colors</span>
              </span>
              <span
                className={`h-4 w-7 shrink-0 rounded-full transition-colors relative ${showAltitudeColors ? "bg-sky-500" : "bg-white/15"
                  }`}
              >
                <span
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${showAltitudeColors ? "translate-x-3.5" : "translate-x-0.5"
                    }`}
                />
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
