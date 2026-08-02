"use client";

import { useState } from "react";

type TravelBadgeProps = {
  onReset: () => void;
  /** Notifies the parent when the mobile expanded/collapsed state changes,
   *  so sibling badges (ClockBadge) can slide out of the way. */
  onExpandedChange?: (expanded: boolean) => void;
};

/**
 * Branded "Point Travel · Indonesia" pill, centered at the top of the map.
 * Clicking it resets the map to its default bounds/zoom.
 *
 * Desktop (md+): unchanged — always shown in full (icon + text).
 * Mobile (<md): collapsed to an icon-only circle by default to save space.
 * Tapping toggles it open (revealing the label, sliding ClockBadge out of
 * the way) or closed again — same tap also resets the map either way.
 */
export default function TravelBadge({
  onReset,
  onExpandedChange,
}: TravelBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  function handleMobileTap() {
    onReset();
    const next = !expanded;
    onExpandedChange?.(next);
    setExpanded(next);
  }

  return (
    <>
      {/* ---------------- MOBILE (< md): icon-only, expands on tap ---------------- */}
      <button
        type="button"
        onClick={handleMobileTap}
        aria-expanded={expanded}
        title="Reset map view"
        className={`md:hidden absolute left-1/2 top-2 z-20 -translate-x-1/2 flex h-9 items-center overflow-hidden rounded-full border border-white/10 bg-black/50 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-all duration-300 ease-out ${expanded
            ? "w-auto max-w-[220px] gap-2 px-3"
            : "w-9 justify-center px-0"
          }`}
      >
        <img
          src="/favicon.ico"
          alt=""
          width={18}
          height={18}
          className="shrink-0 rounded-sm"
        />
        <span
          className={`whitespace-nowrap text-xs font-semibold tracking-wide text-white transition-all duration-300 ${expanded ? "max-w-[160px] opacity-100" : "max-w-0 opacity-0"
            }`}
        >
          Point Travel · Indonesia
        </span>
      </button>

      {/* ---------------- DESKTOP (>= md): unchanged ---------------- */}
      <button
        type="button"
        onClick={onReset}
        title="Reset map view"
        className="hidden md:flex absolute left-1/2 top-4 z-10 -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/50 px-4 py-2 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-colors hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
      >
        <img
          src="/favicon.ico"
          alt=""
          width={18}
          height={18}
          className="shrink-0 rounded-sm"
        />
        <span className="text-sm font-semibold tracking-wide text-white">
          Point Travel
        </span>
        <span className="h-3.5 w-px bg-white/20" />
        <span className="text-xs font-medium text-white/50">Indonesia</span>
      </button>
    </>
  );
}