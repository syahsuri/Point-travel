"use client";

type ClockBadgeProps = {
  nowWib: string;
};
/*
 * Centered pill showing the live WIB clock, ticking every second (driven by
*/
export default function ClockBadge({ nowWib }: ClockBadgeProps) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-2 md:top-14 z-10 -translate-x-1/2 rounded-md border border-white/10 bg-black/50 px-3 py-1.5 text-xs font-mono font-medium text-white/85 backdrop-blur shadow-lg">
      {nowWib} <span className="text-white/40">WIB</span>
    </div>
  );
}