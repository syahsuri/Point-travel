"use client";

import { useState, useRef } from "react";
import type { Airport, ScheduleEntry } from "@/lib/types";

type AirportDetailSidebarProps = {
  airport: Airport;
  onClose: () => void;
  airportBoardTab: "arrival" | "departure";
  onAirportBoardTabChange: (tab: "arrival" | "departure") => void;
  schedule: ScheduleEntry[];
  scheduleLoading: boolean;
  fmtSchedText: (iso: string | null) => string | null;
  statusTextClassFn: (status: string | null | undefined) => string;
};

/**
 * Detail sidebar for a selected airport: header (name/codes/close), a
 * placeholder photo, static info rows (IATA/ICAO/country/type), and the
 * arrivals/departures schedule board.
 */
export default function AirportDetailSidebar({
  airport,
  onClose,
  airportBoardTab,
  onAirportBoardTabChange,
  schedule,
  scheduleLoading,
  fmtSchedText,
  statusTextClassFn,
}: AirportDetailSidebarProps) {
  const [isMinimized, setIsMinimized] = useState(true);

  // Reset to minimized whenever a different airport is selected. Doing this
  // during render (compared against a ref) instead of in a useEffect avoids
  // the synchronous setState-in-effect cascading-render lint error.
  const airportKey = `${airport.icao_code ?? ""}|${airport.name}`;
  const prevAirportKeyRef = useRef(airportKey);
  if (prevAirportKeyRef.current !== airportKey) {
    prevAirportKeyRef.current = airportKey;
    setIsMinimized(true);
  }

  return (
    <div className="absolute z-20 flex flex-col overflow-hidden bg-black/85 md:bg-black/70 text-xs text-white/85 backdrop-blur-md shadow-2xl transition-all bottom-0 left-0 w-full rounded-t-2xl border-t border-white/15 md:bottom-auto md:left-4 md:top-16 md:w-72 md:max-h-[calc(100dvh-5rem)] md:rounded-md md:border md:border-sky-400/20">
      {/* Mobile drag handle bar */}
      <button
        type="button"
        onClick={() => setIsMinimized((v) => !v)}
        className="md:hidden w-full pt-2 pb-1 flex items-center justify-center cursor-pointer select-none active:opacity-70"
        aria-label={isMinimized ? "Expand sheet" : "Minimize sheet"}
      >
        <span className="h-1.5 w-10 rounded-full bg-white/30" />
      </button>

      {isMinimized ? (
        <div className="md:hidden flex items-center justify-between px-3 py-2 pb-3">
          <div
            className="flex items-center gap-2 min-w-0 cursor-pointer"
            onClick={() => setIsMinimized(false)}
          >
            <span className="text-sky-400 text-base leading-none">✈</span>
            <span className="font-bold text-white truncate text-sm">
              {airport.name}
            </span>
            {(airport.iata_code || airport.icao_code) && (
              <span className="text-white/60 text-xs font-mono shrink-0">
                {[airport.iata_code, airport.icao_code].filter(Boolean).join("/")}
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
        <div className="flex flex-col max-h-[50vh] md:max-h-full">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-white/10 px-3 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sky-400 text-base leading-none">✈</span>
                <span className="truncate text-sm font-semibold text-white">
                  {airport.name}
                </span>
              </div>
              {(airport.iata_code || airport.icao_code) && (
                <div className="mt-0.5 text-white/60">
                  {[airport.iata_code, airport.icao_code].filter(Boolean).join(" / ")}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded px-1.5 text-base leading-none text-white/60 hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>

          {/* Placeholder photo */}
          <div className="px-3 pt-3 pb-2 border-b border-white/5 bg-white/5 shrink-0">
            <div className="relative aspect-video w-full overflow-hidden rounded border border-white/10 bg-black/40">
              <img
                src="/images/plane-placeholder.png"
                alt="Airport"
                className="w-full h-full object-cover opacity-75"
              />
              <div className="absolute inset-0 flex flex-col justify-end p-2 bg-linear-to-t from-black/70 via-transparent">
                <span className="text-[11px] font-semibold text-white leading-tight">
                  {airport.name}
                </span>
                {airport.iata_code && (
                  <span className="text-[10px] text-sky-300">{airport.iata_code}</span>
                )}
              </div>
              <div className="absolute top-1 right-2 rounded bg-black/60 px-1 text-[9px] text-white/50">
                Placeholder Photo
              </div>
            </div>
          </div>

          {/* Info rows — fixed, right below the photo */}
          <dl className="divide-y divide-white/5 border-b border-white/10 shrink-0">
            {(
              [
                ["IATA", airport.iata_code],
                ["ICAO", airport.icao_code],
                ["Country", airport.iso_country || null],
                [
                  "Type",
                  airport.type
                    ? airport.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                    : null,
                ],
              ] as [string, string | null][]
            )
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 px-3 py-1.5">
                  <dt className="shrink-0 text-white/45">{label}</dt>
                  <dd className="truncate text-right text-white/90">{value}</dd>
                </div>
              ))}
          </dl>

          {/* ARRIVAL/DEPARTURE TABS */}
          <div className="flex border-b border-white/10 bg-white/5 shrink-0 text-[11px]">
            <button
              type="button"
              onClick={() => onAirportBoardTabChange("departure")}
              className={`flex-1 py-1.5 text-center font-medium border-b-2 transition-all focus:outline-none ${
                airportBoardTab === "departure"
                  ? "border-sky-500 text-white bg-white/5"
                  : "border-transparent text-white/50 hover:text-white/80"
              }`}
            >
              Departures
            </button>
            <button
              type="button"
              onClick={() => onAirportBoardTabChange("arrival")}
              className={`flex-1 py-1.5 text-center font-medium border-b-2 transition-all focus:outline-none ${
                airportBoardTab === "arrival"
                  ? "border-sky-500 text-white bg-white/5"
                  : "border-transparent text-white/50 hover:text-white/80"
              }`}
            >
              Arrivals
            </button>
          </div>

          {/* Schedule list — the only scrolling region now */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {scheduleLoading && (
              <div className="px-3 py-4 text-center text-white/40">Loading…</div>
            )}
            {!scheduleLoading && schedule.length === 0 && (
              <div className="px-3 py-4 text-center text-white/40">No flights found.</div>
            )}
            {!scheduleLoading && schedule.length > 0 && (
              <ul className="divide-y divide-white/5">
                {schedule.map((s, i) => {
                  const time = fmtSchedText(s.sched_time);
                  const route = s.route_airport_iata ?? "???";
                  return (
                    <li
                      key={`${s.flight_no ?? s.callsign ?? i}-${s.sched_time ?? i}`}
                      className="flex flex-col gap-0.5 px-3 py-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-white/90">
                          {s.flight_no ?? s.callsign ?? "—"}
                        </span>
                        <span className="shrink-0 truncate text-white/50">
                          {s.airline_name ?? ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[10px]">
                        <span className="text-white/60">{time ?? "—"}</span>
                        {s.board_status && (
                          <span className={`font-medium ${statusTextClassFn(s.board_status)}`}>
                            {s.board_status}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[10px] text-white/45">
                        <span>{airportBoardTab === "departure" ? "To" : "From"}</span>
                        <span className="truncate">{route}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}