"use client";

type TravelBadgeProps = {
  onReset: () => void;
};

/**
 * Branded "Point Travel · Indonesia" pill, centered at the top of the map.
 * Doubles as a reset control — clicking it returns the map to its default
 * bounds/zoom (wired by the parent via `onReset`).
 */
export default function TravelBadge({ onReset }: TravelBadgeProps) {
  return (
    <button
      type="button"
      onClick={onReset}
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
  );
}