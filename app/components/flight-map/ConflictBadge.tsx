"use client";

import { useState } from "react";

type ConflictBadgeProps = {
  conflictCount: number;
  onClick?: () => void;
};

export default function ConflictBadge({
  conflictCount,
  onClick,
}: ConflictBadgeProps) {
  const [dismissed, setDismissed] = useState(false);
  if (conflictCount <= 0 || dismissed) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group absolute left-1/2 top-16 md:top-14 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-red-500/30 bg-red-950/80 px-3.5 py-1.5 text-xs font-semibold text-red-100 shadow-lg shadow-red-900/20 backdrop-blur-md transition-all hover:bg-red-900/80 hover:scale-105 active:scale-95 animate-pulse-slow"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-inner">
        ⚠
      </span>
      <span>
        {conflictCount} {conflictCount === 1 ? "conflict" : "conflicts"}
      </span>

      {/* Dismiss */}
      <span
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
        className="ml-1 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-[10px] text-red-300/60 transition-colors hover:bg-red-500/20 hover:text-red-100"
        title="Dismiss"
      >
        ✕
      </span>
    </button>
  );
}