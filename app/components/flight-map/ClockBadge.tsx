"use client";

type ClockBadgeProps = {
  nowWib: string;
  /** When true, slides the badge left and fades it out — used on mobile
   *  when TravelBadge expands and would otherwise overlap it. */
  pushedAway?: boolean;
};

/*
 * Live WIB clock, ticking every second. Sits immediately to the right of
 * the settings gear (BasemapSwitcher, left-2/left-4 + w-9/w-10 h-9/h-10),
 * rather than centered — same row, same height, as a paired control.
 *
 * Mobile shows "HH:MM" only (seconds hidden — too granular to be useful at
 * a glance on a small badge); desktop keeps the full "HH:MM:SS".
 */
export default function ClockBadge({
  nowWib,
  pushedAway = false,
}: ClockBadgeProps) {
  // nowWib is always "HH:MM:SS" — split once instead of reformatting upstream.
  const [hhmm, secs] = [nowWib.slice(0, 5), nowWib.slice(5)];

  return (
    <div
      className={`pointer-events-none absolute left-11 top-2 md:left-16 md:top-4 z-10 flex h-9 md:h-10 items-center rounded-md border border-white/10 bg-black/50 px-3 text-xs font-mono font-medium text-white/85 backdrop-blur shadow-lg transition-all duration-300 ease-out ${pushedAway ? "-translate-x-24 opacity-0" : "translate-x-0 opacity-100"
        }`}
    >
      {hhmm}
      <span className="hidden md:inline">{secs}</span>
      <span className="ml-1 text-white/40">WIB</span>
    </div>
  );
}