"use client";

import { useState } from "react";
import type { StateVector, TripHistory } from "@/lib/types";
import { usePlanePhoto } from "@/lib/hooks/usePlanePhoto";
import { aircraftCategoryVisual } from "@/lib/format";

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
  const [minimizedState, setMinimizedState] = useState({
    icao24: selected.icao24,
    isMinimized: true,
  });

  if (minimizedState.icao24 !== selected.icao24) {
    setMinimizedState({ icao24: selected.icao24, isMinimized: true });
  }

  const isMinimized = minimizedState.isMinimized;
  const setIsMinimized = (value: boolean | ((prev: boolean) => boolean)) =>
    setMinimizedState((s) => ({
      ...s,
      isMinimized: typeof value === "function" ? value(s.isMinimized) : value,
    }));

  const categoryVisual = aircraftCategoryVisual(selected.category);
  const aircraftPhoto = (
    <div className="px-3 pt-3 pb-2 border-b border-white/5 bg-white/5 shrink-0">
      <div className="relative aspect-video w-full overflow-hidden rounded border border-white/10 bg-black/40">
        {planePhoto ? (
          <a
            href={planePhoto.link}
            target="_blank"
            rel="noopener"
            className="block h-full w-full cursor-pointer"
          >
            <img
              src={planePhoto.thumbnailLarge.src}
              alt={`Aircraft photographed by ${planePhoto.photographer}`}
              className="w-full h-full object-cover opacity-90"
            />
          </a>
        ) : (
          <img
            src="/images/plane-placeholder.png"
            alt="Aircraft"
            className="w-full h-full object-cover opacity-90"
          />
        )}
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
  );

  const aircraftRows = (
    <dl className="divide-y divide-white/5">
      {aircraftDetailRows
        .filter(([, v]) => v)
        .map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 px-3 py-1.5">
            <dt className="shrink-0 text-white/45">{label}</dt>
            {label === "Category" && categoryVisual ? (
              <dd className="flex justify-end">
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${categoryVisual.className}`}
                >
                  <span>{categoryVisual.icon}</span>
                  {categoryVisual.label}
                </span>
              </dd>
            ) : (
              <dd className="truncate text-right text-white/90">{value}</dd>
            )}
          </div>
        ))}
    </dl>
  );

  const header = (
    <div className="flex items-start justify-between gap-2 border-b border-white/10 px-3 py-2 shrink-0">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${selected.on_ground ? "bg-white/40" : "bg-emerald-400"
              }`}
          />
          <span className="truncate text-sm font-semibold text-white">
            {(selected.callsign ?? "").trim() || selected.icao24}
          </span>
        </div>
        {(selected.origin_iata || selected.destination_iata) && (
          <div className="mt-0.5 flex items-center gap-1.5 text-white/60">
            <span>
              {selected.origin_iata ?? "???"} → {selected.destination_iata ?? "???"}
            </span>
            {categoryVisual && (
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${categoryVisual.className}`}
              >
                <span>{categoryVisual.icon}</span>
                {categoryVisual.label}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleFollow}
          aria-pressed={follow}
          className={`rounded px-2 py-1 text-[11px] font-medium ${follow
            ? "bg-sky-500 text-white"
            : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
        >
          Follow
        </button>
        <button
          type="button"
          onClick={() => setIsMinimized((v) => !v)}
          className="md:hidden rounded px-2 py-1 text-[11px] font-medium bg-white/10 text-white/70 hover:bg-white/20"
        >
          {isMinimized ? "Expand ▲" : "Minimize ▼"}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded px-1.5 text-lg leading-none text-white/60 hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
      </div>
    </div>
  );

  const progressCard = (
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
        <span>Sched {fmtSchedText(selected.scheduled_departure) ?? "—"}</span>
        <span>Sched {fmtSchedText(selected.scheduled_arrival) ?? "—"}</span>
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
  );

  const replayBar = history && history.path.length >= 2 && (
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
  );

  const flightRows = (
    <dl className="divide-y divide-white/5">
      {flightDetailRows
        .filter(([, v]) => v)
        .map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 px-3 py-1.5">
            <dt className="shrink-0 text-white/45">{label}</dt>
            <dd className="truncate text-right text-white/90">{value}</dd>
          </div>
        ))}
    </dl>
  );

  return (
    <>
      {/* ---------- MOBILE: single-column bottom sheet (< md) ---------- */}
      <div className="md:hidden absolute z-20 flex flex-col overflow-hidden bg-black/85 text-xs text-white/85 backdrop-blur-md shadow-2xl bottom-0 left-0 w-full rounded-t-2xl border-t border-white/15 transition-all">
        {/* Drag handle bar */}
        <button
          type="button"
          onClick={() => setIsMinimized((v) => !v)}
          className="w-full pt-2 pb-1 flex items-center justify-center cursor-pointer select-none active:opacity-70"
          aria-label={isMinimized ? "Expand sheet" : "Minimize sheet"}
        >
          <span className="h-1.5 w-10 rounded-full bg-white/30" />
        </button>

        {isMinimized ? (
          <div className="flex items-center justify-between px-3 py-2 pb-3">
            <div
              className="flex items-center gap-2 min-w-0 cursor-pointer"
              onClick={() => setIsMinimized(false)}
            >
              <span
                className={`inline-block h-2 w-2 shrink-0 rounded-full ${selected.on_ground ? "bg-white/40" : "bg-emerald-400"
                  }`}
              />
              <span className="font-bold text-white truncate text-sm">
                {(selected.callsign ?? "").trim() || selected.icao24}
              </span>
              {(selected.origin_iata || selected.destination_iata) && (
                <span className="text-white/60 text-xs shrink-0">
                  {selected.origin_iata ?? "???"} →{" "}
                  {selected.destination_iata ?? "???"}
                </span>
              )}
              {categoryVisual && (
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${categoryVisual.className}`}
                >
                  <span>{categoryVisual.icon}</span>
                  {categoryVisual.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsMinimized(false)}
                className="rounded bg-sky-500/20 text-sky-300 px-2 py-1 text-[11px] font-medium"
              >
                Expand ▲
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="text-white/60 hover:text-white px-1 text-base leading-none"
              >
                ×
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col max-h-[75vh]">
            {header}
            <div className="flex-1 min-h-0 overflow-y-auto pb-4">
              {progressCard}
              {replayBar}
              {flightRows}

              <button
                type="button"
                onClick={() => setAircraftOpen((v) => !v)}
                className="flex w-full items-center justify-between border-y border-white/10 bg-white/5 px-3 py-2 text-[11px] font-medium text-white/80 hover:bg-white/10"
                aria-expanded={aircraftOpen}
              >
                <span>Aircraft</span>
                <span
                  className={`text-white/50 transition-transform ${aircraftOpen ? "rotate-180" : ""
                    }`}
                >
                  ▾
                </span>
              </button>
              {aircraftOpen && (
                <div>
                  {aircraftPhoto}
                  {aircraftRows}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ---------- DESKTOP: side-by-side dual pane (>= md) ---------- */}
      <div className="hidden md:flex absolute left-4 top-16 z-10 max-h-[calc(100dvh-5rem-6rem)] overflow-hidden rounded-md border border-white/10 bg-black/70 text-xs text-white/85 backdrop-blur">
        <div className="flex w-72 min-h-0 shrink-0 flex-col overflow-hidden">
          {header}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {progressCard}
            {replayBar}
            {flightRows}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAircraftOpen((v) => !v)}
          aria-expanded={aircraftOpen}
          aria-label="Toggle aircraft details"
          className={`flex w-5 shrink-0 items-center justify-center border-l border-white/10 transition-colors ${aircraftOpen
            ? "bg-white/5 text-white/50 hover:bg-white/10"
            : "bg-sky-500/80 text-white hover:bg-sky-500"
            }`}
        >
          <span
            className={`text-sm transition-transform ${aircraftOpen ? "" : "rotate-180"
              }`}
          >
            ‹
          </span>
        </button>

        {aircraftOpen && (
          <div className="flex w-72 min-h-0 shrink-0 flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2 shrink-0">
              <span className="text-sm font-semibold text-white">Aircraft</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {aircraftPhoto}
              {aircraftRows}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
