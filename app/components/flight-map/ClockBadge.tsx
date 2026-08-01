"use client";

type ClockBadgeProps = {
  nowWib: string;
};
/*
 * Live WIB clock, ticking every second. Sits immediately to the right of
 * the settings gear (BasemapSwitcher, left-2/left-4 + w-9/w-10 h-9/h-10),
 * rather than centered — same row, same height, as a paired control.
 */
export default function ClockBadge({ nowWib }: ClockBadgeProps) {
  return (
    <div className="pointer-events-none absolute left-14 top-2 md:left-16 md:top-4 z-10 flex h-9 md:h-10 items-center rounded-md border border-white/10 bg-black/50 px-3 text-xs font-mono font-medium text-white/85 backdrop-blur shadow-lg">
      {nowWib} <span className="ml-1 text-white/40">WIB</span>
    </div>
  );
}