"use client";

import { useState } from "react";
import type { StateVector, TripHistory } from "@/lib/types";
import { usePlanePhoto } from "@/lib/hooks/usePlanePhoto";

type PlaneDetailSidebarProps = {
  selected: StateVector;
  history: TripHistory | null;
  follow: boolean;
  onToggleFollow: () => void;
  onClose: () => void;
  flightDetailRows: [string, string | null][];
  aircraftDetailRows: [string, string | null][];
  progress: { pct: number; traveledKm: number; remainingKm: number } | null;
  eta: string | null;
  replayT: number;
  onReplayTChange: (t: number) => void;
  replaying: boolean;
  onReplayingChange: (r: boolean) => void;
  timeAgoText: (iso: string | null | undefined) => string;
  fmtSchedText: (iso: string | null) => string | null;
};

export default function PlaneDetailSidebar({
  selected,
  history,
  follow,
  onToggleFollow,
  onClose,
  flightDetailRows,
  aircraftDetailRows,
  progress,
  eta,
  replayT,
  onReplayTChange,
  replaying,
  onReplayingChange,
  timeAgoText,
  fmtSchedText,
}: PlaneDetailSidebarProps) {
  const { photo: planePhoto, loading: planePhotoLoading } = usePlanePhoto(
    selected.icao24
  );
  const [aircraftOpen, setAircraftOpen] = useState(true);

  return (
    <div className="absolute left-4 top-16 z-10 flex max-h-[calc(100dvh-5rem-6rem)] overflow-hidden rounded-md border border-white/10 bg-black/70 text-xs text-white/85 backdrop-blur">
      {/* Flight column */}
      <div className="flex w-72 min-h-0 shrink-0 flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-2 border-b border-white/10 px-3 py-2 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                  selected.on_ground ? "bg-white/40" : "bg-emerald-400"
                }`}
              />
              <span className="truncate text-sm font-semibold text-white">
                {(selected.callsign ?? "").trim() || selected.icao24}
              </span>
            </div>
            {(selected.origin_iata || selected.destination_iata) && (
              <div className="mt-0.5 text-white/60">
                {selected.origin_iata ?? "???"} →{" "}
                {selected.destination_iata ?? "???"}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onToggleFollow}
              aria-pressed={follow}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                follow
                  ? "bg-sky-500/80 text-white"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              Follow
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded px-1.5 text-base leading-none text-white/60 hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto" dir="rtl">
          <div dir="ltr">
            {/* Flight progress card */}
            <div className="border-b border-white/10 bg-black/20 px-3 py-3 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-white">
                  {selected.origin_iata ?? "???"}
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-sm text-black">
                  ✈
                </span>
                <span className="text-lg font-bold text-white">
                  {selected.destination_iata ?? "???"}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-white/50">
                <span>
                  Sched {fmtSchedText(selected.scheduled_departure) ?? "—"}
                </span>
                <span>
                  Sched {fmtSchedText(selected.scheduled_arrival) ?? "—"}
                </span>
              </div>
              {progress && (
                <>
                  <div className="relative mt-3 h-1 rounded-full bg-white/10">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-amber-400"
                      style={{ width: `${progress.pct}%` }}
                    />
                    <span
                      className="absolute -top-1.75 -translate-x-1/2 text-[13px]"
                      style={{ left: `${progress.pct}%` }}
                    >
                      ✈
                    </span>
                  </div>
                  <div className="mt-1.5 flex justify-between text-[10px] text-white/45">
                    <span>
                      {Math.round(progress.traveledKm).toLocaleString()} km
                      {timeAgoText(selected.last_time_position)
                        ? ` · ${timeAgoText(selected.last_time_position)}`
                        : ""}
                    </span>
                    <span>
                      {Math.round(progress.remainingKm).toLocaleString()} km
                      {eta ? ` · in ${eta}` : ""}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Replay scrubber */}
            {history && history.path.length >= 2 && (
              <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
                <button
                  type="button"
                  onClick={() => {
                    if (replayT >= 1) onReplayTChange(0);
                    onReplayingChange(!replaying);
                  }}
                  className="shrink-0 rounded bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80 hover:bg-white/20"
                >
                  {replaying ? "⏸" : "▶"} Replay
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.001}
                  value={replayT}
                  onChange={(e) => {
                    onReplayingChange(false);
                    onReplayTChange(Number(e.target.value));
                  }}
                  className="h-1 w-full cursor-pointer accent-fuchsia-500"
                />
              </div>
            )}

            {/* Flight detail rows */}
            <dl className="divide-y divide-white/5">
              {flightDetailRows
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between gap-3 px-3 py-1.5"
                  >
                    <dt className="shrink-0 text-white/45">{label}</dt>
                    <dd className="truncate text-right text-white/90">
                      {value}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Toggle handle */}
      <button
        type="button"
        onClick={() => setAircraftOpen((v) => !v)}
        aria-expanded={aircraftOpen}
        aria-label="Toggle aircraft details"
        className={`flex w-5 shrink-0 items-center justify-center border-l border-white/10 transition-colors ${
          aircraftOpen
            ? "bg-white/5 text-white/50 hover:bg-white/10"
            : "bg-sky-500/80 text-white hover:bg-sky-500"
        }`}
      >
        <span
          className={`text-sm transition-transform ${
            aircraftOpen ? "" : "rotate-180"
          }`}
        >
          ‹
        </span>
      </button>

      {/* Aircraft column */}
      {aircraftOpen && (
        <div className="flex w-72 min-h-0 shrink-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2 shrink-0">
            <span className="text-sm font-semibold text-white">Aircraft</span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto" dir="rtl">
            <div dir="ltr">
              <div className="px-3 pt-3 pb-2 border-b border-white/5 bg-white/5 shrink-0">
                <div className="relative aspect-video w-full overflow-hidden rounded border border-white/10 bg-black/40">
                  <img
                    src={
                      planePhoto?.thumbnailLarge.src ??
                      "/images/plane-placeholder.png"
                    }
                    alt={
                      planePhoto
                        ? `Aircraft photographed by ${planePhoto.photographer}`
                        : "Aircraft"
                    }
                    className="w-full h-full object-cover opacity-90"
                  />
                  {planePhotoLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] text-white/60">
                      Loading photo…
                    </div>
                  )}
                  {!planePhotoLoading && !planePhoto && (
                    <div className="absolute bottom-1 right-2 rounded bg-black/60 px-1 text-[9px] text-white/50">
                      No photo available
                    </div>
                  )}
                </div>
                {planePhoto && (
                  <div className="mt-1 flex items-center justify-between text-[10px] text-white/45">
                    <span>Photo by {planePhoto.photographer}</span>

                    <a
                      href={planePhoto.link}
                      target="_blank"
                      rel="noopener"
                      className="text-sky-400 underline hover:text-sky-300"
                    >
                      View on Planespotters
                    </a>
                  </div>
                )}
              </div>

              <dl className="divide-y divide-white/5">
                {aircraftDetailRows
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div
                      key={label}
                      className="flex justify-between gap-3 px-3 py-1.5"
                    >
                      <dt className="shrink-0 text-white/45">{label}</dt>
                      <dd className="truncate text-right text-white/90">
                        {value}
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
