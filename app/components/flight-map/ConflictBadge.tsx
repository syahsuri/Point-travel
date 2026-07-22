"use client";

type ConflictBadgeProps = {
  conflictCount: number;
};

/**
 * Top-center warning badge showing the near-miss radar count. Renders
 * nothing when there are no conflicts.
 */
export default function ConflictBadge({ conflictCount }: ConflictBadgeProps) {
  if (conflictCount <= 0) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full border border-red-400/40 bg-red-950/70 px-3 py-1 text-xs font-semibold text-red-200 backdrop-blur">
      ⚠ {conflictCount} near-miss {conflictCount === 1 ? "pair" : "pairs"}
    </div>
  );
}