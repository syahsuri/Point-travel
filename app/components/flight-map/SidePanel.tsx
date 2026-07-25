"use client";

import type { StateVector, Airport } from "@/lib/types";
import { timeAgo, posSecs } from "@/lib/format";

type SidePanelProps = {
  panelTab: "flights" | "airports";
  onPanelTabChange: (tab: "flights" | "airports") => void;
  listOpen: boolean;
  onToggleListOpen: () => void;

  // Flights tab
  planeList: StateVector[];
  filteredPlanes: StateVector[];
  query: string;
  onQueryChange: (q: string) => void;
  sortDesc: boolean;
  onToggleSortDesc: () => void;
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
  planeList,
  filteredPlanes,
  query,
  onQueryChange,
  sortDesc,
  onToggleSortDesc,
  selectedIcao24,
  onSelectPlane,
  airportList,
  filteredAirports,
  airportQuery,
  onAirportQueryChange,
  selectedAirport,
  onSelectAirport,
}: SidePanelProps) {
  return (
    <div className="absolute right-4 top-4 z-10 flex max-h-[calc(100dvh-2rem)] w-64 flex-col overflow-hidden rounded-md border border-white/10 bg-black/55 text-xs backdrop-blur">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => onPanelTabChange("flights")}
          className={`flex-1 px-3 py-2 text-center font-semibold border-b-2 transition-colors ${
            panelTab === "flights"
              ? "border-sky-500 text-white bg-white/5"
              : "border-transparent text-white/50 hover:text-white/80"
          }`}
        >
          Flights ({planeList.length})
        </button>
        <button
          type="button"
          onClick={() => onPanelTabChange("airports")}
          className={`flex-1 px-3 py-2 text-center font-semibold border-b-2 transition-colors ${
            panelTab === "airports"
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
              className="flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-white/90 placeholder:text-white/35 focus:border-white/25 focus:outline-none"
            />
            <button
              type="button"
              onClick={onToggleSortDesc}
              title={
                sortDesc
                  ? "Sorting: Newest First (Desc)"
                  : "Sorting: Oldest First (Asc)"
              }
              className="rounded border border-white/10 bg-white/5 px-2 py-1 text-white/90 hover:bg-white/10 hover:border-white/25 focus:outline-none flex items-center justify-center font-medium shrink-0 min-w-10"
            >
              <span>{sortDesc ? "↓" : "↑"}</span>
            </button>
          </div>
          <ul className="divide-y divide-white/5 overflow-y-auto">
            {[...filteredPlanes]
              .sort((a, b) => {
                const tA = posSecs(a.last_time_position);
                const tB = posSecs(b.last_time_position);
                const valA = Number.isNaN(tA) ? 0 : tA;
                const valB = Number.isNaN(tB) ? 0 : tB;
                if (valA !== valB) return sortDesc ? valB - valA : valA - valB;
                return (a.callsign ?? "").localeCompare(b.callsign ?? "");
              })
              .map((p) => {
                const cs = (p.callsign ?? "").trim() || p.icao24;
                const alt =
                  typeof p.baro_altitude === "number"
                    ? `${Math.round(p.baro_altitude * 3.281).toLocaleString()} ft`
                    : "—";
                const spd =
                  typeof p.velocity === "number"
                    ? `${Math.round(p.velocity * 1.944)} kts`
                    : "—";
                const route =
                  p.origin_iata || p.destination_iata
                    ? `${p.origin_iata ?? "???"} → ${p.destination_iata ?? "???"}`
                    : null;
                const ago = timeAgo(p.last_time_position);
                const meta = [p.flight_status, ago].filter(Boolean).join(" · ");
                return (
                  <li key={p.icao24}>
                    <button
                      type="button"
                      onClick={() => onSelectPlane(p)}
                      className={`flex w-full flex-col gap-0.5 px-3 py-1.5 text-left hover:bg-white/10 ${
                        selectedIcao24 === p.icao24 ? "bg-sky-500/20" : ""
                      }`}
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 truncate">
                          <span
                            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                              p.on_ground ? "bg-white/40" : "bg-emerald-400"
                            }`}
                          />
                          <span className="truncate font-medium text-white/90">{cs}</span>
                        </span>
                        <span className="shrink-0 text-white/50">
                          {alt} · {spd}
                        </span>
                      </span>
                      {(route || meta) && (
                        <span className="flex w-full items-center justify-between gap-2 pl-3 text-[10px] text-white/45">
                          <span className="truncate">{route ?? ""}</span>
                          {meta && <span className="shrink-0">{meta}</span>}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
          </ul>
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
                key={`${a.icao_code ?? a.iata_code ?? a.name}-${a.latitude_deg}-${a.longitude_deg}-${i}`}
              >
                <button
                  type="button"
                  onClick={() => onSelectAirport(a)}
                  className={`flex w-full flex-col gap-0.5 px-3 py-1.5 text-left hover:bg-white/10 ${
                    selectedAirport?.icao_code === a.icao_code &&
                    selectedAirport?.name === a.name
                      ? "bg-sky-500/20"
                      : ""
                  }`}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="truncate font-medium text-white/90">{a.name}</span>
                    <span className="shrink-0 text-white/50">
                      {[a.iata_code, a.icao_code].filter(Boolean).join(" / ") || "—"}
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
  );
}