"use client";

import { useState } from "react";
import type { StateVector, Airport } from "@/lib/types";
import { ageSeconds, formatAge } from "@/lib/format";
import { planeTypeBadgeClass, planeTypeShortLabel } from "@/lib/planeType";
import { squawkAlertLevel, squawkLabel } from "@/lib/squawk";

// The whole feed runs ~1–2 min behind, so a row shows its age only when it
// lags the newest position by this much.
const STALE_SECS = 120;
// Footer turns amber when even the newest position is this old (pipeline stalled).
const FEED_STALE_SECS = 300;

const callsignOf = (p: StateVector) => (p.callsign ?? "").trim() || p.icao24;
const isMilitary = (p: StateVector) =>
  p.plane_type === "Military" || p.plane_type === "Military & Special";

/** Display strings for one flights-list row (shared by mobile + desktop). */
function planeRow(p: StateVector, dataAge: number | null) {
  const age = ageSeconds(p.last_time_position);
  return {
    cs: callsignOf(p),
    alt:
      typeof p.baro_altitude === "number"
        ? `${Math.round(p.baro_altitude * 3.281).toLocaleString()} ft`
        : "—",
    spd:
      typeof p.velocity === "number"
        ? `${Math.round(p.velocity * 1.944)} kts`
        : "—",
    route:
      p.origin_iata || p.destination_iata
        ? `${p.origin_iata ?? "???"} → ${p.destination_iata ?? "???"}`
        : null,
    meta: p.flight_status ?? "",
    stale:
      age !== null && dataAge !== null && age - dataAge >= STALE_SECS
        ? formatAge(age)
        : null,
    // Civil is the default; only flag the exceptions.
    badgeClass: p.plane_type === "Civil" ? null : planeTypeBadgeClass(p.plane_type),
    badgeLabel: planeTypeShortLabel(p.plane_type),
    emergency:
      squawkAlertLevel(p.squawk) === "emergency" ? squawkLabel(p.squawk) : null,
  };
}

function FilterChip({
  label,
  count,
  on,
  dotClass,
  onClick,
  sizeClass,
}: {
  label: string;
  count: number;
  on: boolean;
  dotClass: string;
  onClick: () => void;
  sizeClass: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border font-semibold transition-colors ${sizeClass} ${on
        ? "border-white/25 bg-white/15 text-white"
        : "border-dashed border-white/15 text-white/40 hover:text-white/70"
        }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${on ? dotClass : "border border-white/40"}`}
      />
      {label}
      <span className={on ? "text-white/60" : "text-white/30"}>{count}</span>
    </button>
  );
}

type SidePanelProps = {
  panelTab: "flights" | "airports";
  onPanelTabChange: (tab: "flights" | "airports") => void;
  listOpen: boolean;
  onToggleListOpen: () => void;
  /** When true (TravelBadge expanded on mobile), collapses the mobile
   *  trigger pill down to icon-only so the two controls don't collide. */
  compact?: boolean;

  // Flights tab
  planeList: StateVector[];
  filteredPlanes: StateVector[];
  query: string;
  onQueryChange: (q: string) => void;

  selectedIcao24: string | null | undefined;
  onSelectPlane: (p: StateVector) => void;

  // Airports tab
  airportList: Airport[];
  filteredAirports: Airport[];
  airportQuery: string;
  onAirportQueryChange: (q: string) => void;
  selectedAirport: Airport | null;
  onSelectAirport: (a: Airport) => void;
};

/**
 * Top-right floating panel with two tabs: a searchable/sortable Flights
 * list and a searchable Airports list. Purely presentational — all
 * filtering/sorting is computed by the parent and passed in as
 * `filteredPlanes`/`filteredAirports`.
 */
export default function SidePanel({
  panelTab,
  onPanelTabChange,
  listOpen,
  onToggleListOpen,
  compact = false,
  planeList,
  filteredPlanes,
  query,
  onQueryChange,

  selectedIcao24,
  onSelectPlane,
  airportList,
  filteredAirports,
  airportQuery,
  onAirportQueryChange,
  selectedAirport,
  onSelectAirport,
}: SidePanelProps) {
  const [showMilitary, setShowMilitary] = useState(true);
  const [showLadd, setShowLadd] = useState(true);
  const [showCivil, setShowCivil] = useState(true);
  const [sortAZ, setSortAZ] = useState(false);

  const handleSelectPlane = (p: StateVector) => {
    onSelectPlane(p);
  };

  const handleSelectAirport = (a: Airport) => {
    onSelectAirport(a);
  };

  const getPlaneTypePriority = (type: string | null | undefined): number => {
    switch (type) {
      case "Military & Special": return 0;
      case "Military": return 1;
      case "Interesting": return 2;
      case "LADD": return 3;
      default: return 4;
    }
  };

  // Default: newest position first. A–Z (callsign only) keeps rows from
  // jumping on every 15s poll. Callsign is the tie-breaker in both.
  const sortedPlanes = [...filteredPlanes].sort(
    (a, b) =>
      getPlaneTypePriority(a.plane_type) - getPlaneTypePriority(b.plane_type) ||
      (sortAZ
        ? 0
        : // Infinity - Infinity is NaN (falsy), so two missing times fall through.
          (ageSeconds(a.last_time_position) ?? Infinity) -
          (ageSeconds(b.last_time_position) ?? Infinity)) ||
      Number(!a.callsign?.trim()) - Number(!b.callsign?.trim()) || // hex-only last
      callsignOf(a).localeCompare(callsignOf(b))
  );

  const displayedPlanes = sortedPlanes.filter((p) => {
    if (isMilitary(p)) return showMilitary;
    if (p.plane_type === "LADD") return showLadd;
    return showCivil;
  });

  const counts = { military: 0, ladd: 0, civil: 0 };
  for (const p of filteredPlanes) {
    if (isMilitary(p)) counts.military++;
    else if (p.plane_type === "LADD") counts.ladd++;
    else counts.civil++;
  }

  // Freshest position in the feed: shows when the data itself stops updating.
  const dataAge = planeList.reduce<number | null>((min, p) => {
    const a = ageSeconds(p.last_time_position);
    return a !== null && (min === null || a < min) ? a : min;
  }, null);

  const renderChips = (sizeClass: string) => (
    <>
      <FilterChip label="Military" count={counts.military} on={showMilitary} dotClass="bg-amber-400" onClick={() => setShowMilitary((v) => !v)} sizeClass={sizeClass} />
      <FilterChip label="LADD" count={counts.ladd} on={showLadd} dotClass="bg-slate-300" onClick={() => setShowLadd((v) => !v)} sizeClass={sizeClass} />
      <FilterChip label="Civil" count={counts.civil} on={showCivil} dotClass="bg-sky-400" onClick={() => setShowCivil((v) => !v)} sizeClass={sizeClass} />
    </>
  );

  const renderSort = (sizeClass: string) => (
    <button
      type="button"
      onClick={() => setSortAZ((v) => !v)}
      title={sortAZ ? "Sorted A–Z. Tap to sort by latest update." : "Sorted by latest update. Tap to sort A–Z."}
      className={`shrink-0 whitespace-nowrap rounded border border-white/15 font-semibold text-white/70 hover:bg-white/10 hover:text-white ${sizeClass}`}
    >
      ⇅ {sortAZ ? "A–Z" : "Latest"}
    </button>
  );

  const renderUpdated = (sizeClass: string) =>
    dataAge !== null && (
      <p
        title="Age of the newest aircraft position in the feed"
        className={`shrink-0 border-t border-white/10 text-right ${sizeClass} ${dataAge >= FEED_STALE_SECS ? "text-amber-400" : "text-white/40"}`}
      >
        Updated {formatAge(dataAge)}
      </p>
    );

  const renderMeta = (r: ReturnType<typeof planeRow>) =>
    (r.meta || r.stale) && (
      <span className="shrink-0">
        {r.meta}
        {r.meta && r.stale && " · "}
        {r.stale && <span className="text-amber-400">{r.stale}</span>}
      </span>
    );

  return (
    <>
      {/* ---------------- MOBILE COMPACT TRIGGER PILL (< md) when list is closed ---------------- */}
      {!listOpen && (
        <button
          type="button"
          onClick={onToggleListOpen}
          className={`md:hidden absolute right-12 top-2 z-20 flex h-9 items-center gap-1 rounded-lg border border-white/10 bg-black/65 px-2.5 text-[11px] font-medium text-white/90 backdrop-blur-md shadow-lg transition-all duration-300 ease-out hover:bg-white/10 active:scale-95 ${compact
            ? "translate-x-24 opacity-0 pointer-events-none"
            : "translate-x-0 opacity-100"
            }`}
        >
          <span>🔍</span>
          <span className="whitespace-nowrap">
            {panelTab === "flights" ? "Flights" : "Airports"}
          </span>
        </button>
      )}
      {/* ---------------- MOBILE FULL DRAWER MODAL (< md) when list is open ---------------- */}
      {listOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex flex-col bg-black/85 backdrop-blur-lg p-3 pt-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base text-sky-400">✈</span>
              <span className="font-semibold text-sm text-white">
                Flight & Airport Explorer
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleListOpen}
              aria-label="Close list"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 active:scale-95 text-sm font-bold"
            >
              ✕
            </button>
          </div>

          <div className="flex items-stretch border-b border-white/10 mt-2 shrink-0">
            <button
              type="button"
              onClick={() => onPanelTabChange("flights")}
              className={`flex-1 py-2.5 text-center font-semibold text-xs border-b-2 transition-colors ${panelTab === "flights"
                ? "border-sky-500 text-white bg-white/5"
                : "border-transparent text-white/50 hover:text-white/80"
                }`}
            >
              Flights ({displayedPlanes.length})
            </button>
            <button
              type="button"
              onClick={() => onPanelTabChange("airports")}
              className={`flex-1 py-2.5 text-center font-semibold text-xs border-b-2 transition-colors ${panelTab === "airports"
                ? "border-sky-500 text-white bg-white/5"
                : "border-transparent text-white/50 hover:text-white/80"
                }`}
            >
              Airports ({airportList.length})
            </button>
          </div>

          {panelTab === "flights" && (
            <div className="flex flex-col flex-1 min-h-0 pt-2">
              <div className="flex gap-2 pb-2 shrink-0">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  placeholder="Search callsign / airline / route…"
                  className="min-w-0 flex-1 rounded border border-white/15 bg-white/10 px-3 py-2 text-base text-white/90 placeholder:text-white/40 focus:border-sky-400 focus:outline-none"
                />
                {renderSort("px-3 text-xs")}
              </div>
              <div className="flex gap-1.5 pb-2 shrink-0 justify-start">
                {renderChips("px-2.5 py-1.5 text-xs")}
              </div>
              <ul className="divide-y divide-white/10 overflow-y-auto flex-1 text-xs">
                {displayedPlanes.map((p) => {
                  const r = planeRow(p, dataAge);
                  return (
                    <li key={p.icao24}>
                      <button
                        type="button"
                        onClick={() => handleSelectPlane(p)}
                        className={`flex w-full flex-col gap-1 px-3 py-2.5 text-left active:bg-white/15 hover:bg-white/10 ${selectedIcao24 === p.icao24 ? "bg-sky-500/25" : ""
                          }`}
                      >
                        <span className="flex w-full items-center justify-between gap-2">
                          <span className="flex items-center gap-2 truncate">
                            <span
                              className={`inline-block h-2 w-2 shrink-0 rounded-full ${p.on_ground ? "bg-white/40" : "bg-emerald-400"
                                }`}
                            />
                            <span className="truncate font-semibold text-white text-sm">
                              {r.cs}
                            </span>
                            {r.badgeClass && (
                              <span
                                className={`shrink-0 rounded border px-1 py-px text-[8px] font-bold uppercase leading-none ${r.badgeClass}`}
                              >
                                {r.badgeLabel}
                              </span>
                            )}
                            {r.emergency && (
                              <span
                                title={`Squawk ${p.squawk}`}
                                className="shrink-0 animate-pulse rounded border border-red-500/50 bg-red-600/35 px-1 py-px text-[9px] font-bold uppercase leading-none text-red-200"
                              >
                                {r.emergency}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-white/60 text-xs flex items-center gap-1.5">
                            <span>{r.alt} · {r.spd}</span>
                          </span>
                        </span>
                        {(r.route || r.meta || r.stale) && (
                          <span className="flex w-full items-center justify-between gap-2 pl-4 text-xs text-white/50">
                            <span className="truncate">{r.route ?? ""}</span>
                            {renderMeta(r)}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {renderUpdated("px-3 pt-2 text-xs")}
            </div>
          )}

          {panelTab === "airports" && (
            <div className="flex flex-col flex-1 min-h-0 pt-2">
              <div className="pb-2 shrink-0">
                <input
                  type="text"
                  value={airportQuery}
                  onChange={(e) => onAirportQueryChange(e.target.value)}
                  placeholder="Search airport name or code…"
                  className="w-full rounded border border-white/15 bg-white/10 px-3 py-2 text-base text-white/90 placeholder:text-white/40 focus:border-sky-400 focus:outline-none"
                />
              </div>
              <ul className="divide-y divide-white/10 overflow-y-auto flex-1 text-xs">
                {filteredAirports.map((a, i) => (
                  <li
                    key={`${a.icao_code ?? a.iata_code ?? a.name}-${a.latitude_deg
                      }-${a.longitude_deg}-${i}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectAirport(a)}
                      className={`flex w-full flex-col gap-1 px-3 py-2.5 text-left active:bg-white/15 hover:bg-white/10 ${selectedAirport?.icao_code === a.icao_code &&
                        selectedAirport?.name === a.name
                        ? "bg-sky-500/25"
                        : ""
                        }`}
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="truncate font-semibold text-white text-sm">
                          {a.name}
                        </span>
                        <span className="shrink-0 text-sky-400 font-mono text-xs">
                          {[a.iata_code, a.icao_code]
                            .filter(Boolean)
                            .join(" / ") || "—"}
                        </span>
                      </span>
                      <span className="text-xs text-white/50">
                        {a.iso_country}
                        {a.type ? ` · ${a.type.replace(/_/g, " ")}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ---------------- DESKTOP PANEL (>= md) ---------------- */}
      <div className="hidden md:flex absolute right-4 top-16 z-20 flex-col overflow-hidden rounded-md border border-white/10 bg-black/55 text-xs backdrop-blur shadow-lg transition-all w-80 max-h-[calc(100dvh-11rem)]">
        <div className="flex items-stretch">
          <button
            type="button"
            onClick={() => onPanelTabChange("flights")}
            className={`flex-1 px-3 py-2 text-center font-semibold border-b-2 transition-colors ${panelTab === "flights"
              ? "border-sky-500 text-white bg-white/5"
              : "border-transparent text-white/50 hover:text-white/80"
              }`}
          >
            Flights ({displayedPlanes.length})
          </button>
          <button
            type="button"
            onClick={() => onPanelTabChange("airports")}
            className={`flex-1 px-3 py-2 text-center font-semibold border-b-2 transition-colors ${panelTab === "airports"
              ? "border-sky-500 text-white bg-white/5"
              : "border-transparent text-white/50 hover:text-white/80"
              }`}
          >
            Airports ({airportList.length})
          </button>
          <button
            type="button"
            onClick={onToggleListOpen}
            className="px-2 text-white/50 hover:bg-white/5 hover:text-white/80"
          >
            {listOpen ? "▾" : "▸"}
          </button>
        </div>

        {listOpen && panelTab === "flights" && (
          <>
            <div className="flex gap-1.5 px-2 py-1.5">
              <input
                type="text"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Search callsign / airline / route…"
                className="min-w-0 flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-white/90 placeholder:text-white/35 focus:border-white/25 focus:outline-none"
              />
              {renderSort("px-2 text-[10px]")}
            </div>
            <div className="flex gap-1 px-2 pb-1.5 justify-start">
              {renderChips("px-2 py-0.5 text-[10px]")}
            </div>
            <ul className="divide-y divide-white/5 overflow-y-auto">
              {displayedPlanes.map((p) => {
                const r = planeRow(p, dataAge);
                return (
                  <li key={p.icao24}>
                    <button
                      type="button"
                      onClick={() => handleSelectPlane(p)}
                      className={`flex w-full flex-col gap-0.5 px-3 py-1.5 text-left hover:bg-white/10 ${selectedIcao24 === p.icao24 ? "bg-sky-500/20" : ""
                        }`}
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 truncate">
                          <span
                            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${p.on_ground ? "bg-white/40" : "bg-emerald-400"
                              }`}
                          />
                          <span className="truncate font-medium text-white/90">{r.cs}</span>
                          {r.badgeClass && (
                            <span
                              className={`shrink-0 rounded border px-1 py-px text-[8px] font-bold uppercase leading-none ${r.badgeClass}`}
                            >
                              {r.badgeLabel}
                            </span>
                          )}
                          {r.emergency && (
                            <span
                              title={`Squawk ${p.squawk}`}
                              className="shrink-0 animate-pulse rounded border border-red-500/50 bg-red-600/35 px-1 py-px text-[9px] font-bold uppercase leading-none text-red-200"
                            >
                              {r.emergency}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-white/50 flex items-center gap-1.5">
                          <span>{r.alt} · {r.spd}</span>
                        </span>
                      </span>
                      {(r.route || r.meta || r.stale) && (
                        <span className="flex w-full items-center justify-between gap-2 pl-3 text-[10px] text-white/45">
                          <span className="truncate">{r.route ?? ""}</span>
                          {renderMeta(r)}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {renderUpdated("px-3 py-1 text-[10px]")}
          </>
        )}

        {listOpen && panelTab === "airports" && (
          <>
            <div className="px-2 py-1.5">
              <input
                type="text"
                value={airportQuery}
                onChange={(e) => onAirportQueryChange(e.target.value)}
                placeholder="Search names …"
                className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-white/90 placeholder:text-white/35 focus:border-white/25 focus:outline-none"
              />
            </div>
            <ul className="divide-y divide-white/5 overflow-y-auto">
              {filteredAirports.map((a, i) => (
                <li
                  key={`${a.icao_code ?? a.iata_code ?? a.name}-${a.latitude_deg
                    }-${a.longitude_deg}-${i}`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectAirport(a)}
                    className={`flex w-full flex-col gap-0.5 px-3 py-1.5 text-left hover:bg-white/10 ${selectedAirport?.icao_code === a.icao_code &&
                      selectedAirport?.name === a.name
                      ? "bg-sky-500/20"
                      : ""
                      }`}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="truncate font-medium text-white/90">
                        {a.name}
                      </span>
                      <span className="shrink-0 text-white/50">
                        {[a.iata_code, a.icao_code]
                          .filter(Boolean)
                          .join(" / ") || "—"}
                      </span>
                    </span>
                    <span className="pl-0.5 text-[10px] text-white/45">
                      {a.iso_country}
                      {a.type ? ` · ${a.type.replace(/_/g, " ")}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}
