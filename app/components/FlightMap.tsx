"use client";

import { useRef, useState, useEffect } from "react";
import type { StateVector, Airport } from "@/lib/types";
import { useKonamiCode } from "@/lib/hooks/useKonamiCode";
import { useWibClock } from "@/lib/hooks/useWibClock";
import { useAirportSelection } from "@/lib/hooks/useAirportSelection";
import { usePlaneSelection } from "@/lib/hooks/usePlaneSelection";
import { useNearMissRadar } from "@/lib/hooks/useNearMissRadar";
import { useChaosModeVisuals } from "@/lib/hooks/useChaosModeVisuals";
import { haversineMeters } from "@/lib/geo";
import { timeAgo, fmtSched, statusTextClass } from "@/lib/format";
import { type Basemap } from "@/lib/mapConstants";
import { setBasemap } from "@/lib/mapStyle";
import { useFlightMapEngine } from "@/lib/hooks/useFlightMapEngine";
import { usePlanePhoto } from "@/lib/hooks/usePlanePhoto";

import ClockBadge from "@/components/flight-map/ClockBadge";
import ConflictBadge from "@/components/flight-map/ConflictBadge";
import ChaosOverlay from "@/components/flight-map/ChaosOverlay";
import AttributionFooter from "@/components/flight-map/AttributionFooter";
import BasemapSwitcher from "@/components/flight-map/BasemapSwitcher";
import SidePanel from "@/components/flight-map/SidePanel";
import PlaneDetailSidebar from "@/components/flight-map/PlaneDetailSidebar";
import AltitudeLegend from "@/components/flight-map/AltitudeLegend";
/**
 * Full-screen FlightRadar24-style map with a basemap switcher.
 *
 * MapLibre touches the DOM and WebGL, so this is a Client Component and the
 * map is created inside useEffect (never during render / on the server).
 *
 * Three basemaps live in ONE style; switching just flips layer visibility
 * (never map.setStyle, which would wipe the planes layer + icon):
 *   - dark      → local Natural Earth GeoJSON polygons (no tiles, lightest, default)
 *   - satellite → ESRI World Imagery + Reference overlay (hybrid labels)
 *   - streets   → OpenStreetMap raster
 * All tile sources are free and need no API key. Planes are one WebGL symbol
 * layer (scales to thousands) rotated by heading, always drawn on top.
 */

export default function FlightMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // IATA -> [lon, lat], loaded once from /data/airports.json. Origin of a
  // trajectory line comes from here (backend gives only origin_iata, not coords).
  const airportsRef = useRef<Record<string, [number, number]>>({});
  // State mirror of the airport lookup, for reads during render (ETA).
  const [airports, setAirports] = useState<Record<string, [number, number]>>(
    {}
  );
  const [basemap, setBasemapState] = useState<Basemap>("streets");
  const [planeList, setPlaneList] = useState<StateVector[]>([]);
  const [airportList, setAirportList] = useState<Airport[]>([]);
  const [listOpen, setListOpen] = useState(true);
  // search panel airports
  const [panelTab, setPanelTab] = useState<"flights" | "airports">("flights");
  const [airportQuery, setAirportQuery] = useState("");
  const [showPlanes, setShowPlanes] = useState(true);
  const [showAltitudeColors, setShowAltitudeColors] = useState(false);
  const [showAirports, setShowAirports] = useState(true);
  // Free-text filter for the flights list.
  const [query, setQuery] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"flight" | "aircraft">("flight");
  // Where we predicted the selected plane would be by the next poll, so the next
  // poll can measure the forecast error. Plus the resulting error (km) for the HUD.

  // Latest planes, readable from the (once-registered) map click handler.
  const planesRef = useRef<StateVector[]>([]);
  // Wall-clock (ms) of the poll that produced `planesRef` — animation baseline.
  const baseTimeRef = useRef<number>(0);
  // Unix seconds timestamp of the last processed backend API update (from res.time).
  const lastApiTimeRef = useRef<number>(0);

  const [chaosMode, setChaosMode] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setTimeout(() => setListOpen(false), 0);
    }
  }, []);

  const {
    selected,
    setSelected,
    history,
    follow,
    toggleFollow,
    followRef,
    accuracyKm,
    setAccuracyKm,
    replayT,
    setReplayT,
    replaying,
    setReplaying,
    selectPlane,
    deselectPlane,
    selectedIcaoRef,
    basePathRef,
    selectedMarkerRef,
    predictedRef,
  } = usePlaneSelection({
    mapRef,
    airportsRef,
    onSelect: () => deselectAirport(),
  });

  const {
    selectedAirport,
    setSelectedAirport,
    airportBoardTab,
    setAirportBoardTab,
    schedule,
    scheduleLoading,
    selectAirport: selectAirportFromList,
    deselectAirport,
  } = useAirportSelection({ mapRef, onSelect: () => deselectPlane() });

  const { conflictCount, turnRateRef, updateTurnRates, drawConflicts } =
    useNearMissRadar({ mapRef });

  function selectBasemap(mode: Basemap) {
    setBasemapState(mode);
    const map = mapRef.current;
    if (map) setBasemap(map, mode);
  }
  function togglePlanes() {
    const next = !showPlanes;
    setShowPlanes(next);
    const map = mapRef.current;
    if (!map) return;
    for (const id of ["planes"]) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", next ? "visible" : "none");
      }
    }
    // Hide the floating selected-plane marker + trajectory too, so toggling
    // off truly clears all plane-related visuals.
    if (!next) {
      selectedMarkerRef.current
        ?.getElement()
        .style.setProperty("display", "none");
    } else {
      selectedMarkerRef.current?.getElement().style.removeProperty("display");
    }
  }

  function toggleAltitudeColors() {
    const next = !showAltitudeColors;
    setShowAltitudeColors(next);
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer("altitude-glow")) {
      map.setLayoutProperty(
        "altitude-glow",
        "visibility",
        next ? "visible" : "none"
      );
    }
  }

  function toggleAirports() {
    const next = !showAirports;
    setShowAirports(next);
    const map = mapRef.current;
    if (!map) return;
    for (const id of [
      "airport-dot",
      "airport-label",
      "selected-airport-icon",
    ]) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", next ? "visible" : "none");
      }
    }
  }

  useFlightMapEngine({
    containerRef,
    mapRef,
    airportsRef,
    planesRef,
    setAirports,
    setAirportList,
    setPlaneList,
    selectPlane,
    deselectPlane,
    setSelectedAirport,
    setAirportBoardTab,
    deselectAirport,
    baseTimeRef,
    lastApiTimeRef,
    selectedIcaoRef,
    followRef,
    basePathRef,
    selectedMarkerRef,
    turnRateRef,
    predictedRef,
    setSelected,
    setAccuracyKm,
    updateTurnRates,
    drawConflicts,
  });

  useKonamiCode(() => {
    setChaosMode(true);
    setTimeout(() => setChaosMode(false), 10_000);
  });

  // Live WIB clock for the HUD, ticking every second.
  const nowWib = useWibClock();

  useChaosModeVisuals({ mapRef, active: chaosMode });

  // Label/value rows for the detail sidebar (nulls filtered out at render).
  const ft = (m: number | null) =>
    typeof m === "number"
      ? `${Math.round(m * 3.281).toLocaleString()} ft`
      : null;

  // ETA to destination: great-circle distance to the dest airport / ground speed,
  // shown as remaining time "1h 23m". Null if destination/speed unknown.
  const eta = ((): string | null => {
    const dest = selected?.destination_iata
      ? airports[selected.destination_iata]
      : undefined;
    if (
      !selected ||
      !dest ||
      typeof selected.velocity !== "number" ||
      selected.velocity <= 0
    ) {
      return null;
    }
    const secs =
      haversineMeters([selected.longitude, selected.latitude], dest) /
      selected.velocity;
    if (!Number.isFinite(secs)) return null;
    const h = Math.floor(secs / 3600);
    const m = Math.round((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  })();

  // Flight progress: % of great-circle distance traveled from origin to
  // current position, out of total origin→destination distance.
  const progress = ((): {
    pct: number;
    traveledKm: number;
    remainingKm: number;
  } | null => {
    if (!selected) return null;
    const origin = selected.origin_iata
      ? airports[selected.origin_iata]
      : undefined;
    const dest = selected.destination_iata
      ? airports[selected.destination_iata]
      : undefined;
    if (!origin || !dest) return null;
    const current: [number, number] = [selected.longitude, selected.latitude];
    const total = haversineMeters(origin, dest);
    if (total === 0) return null;
    const traveled = haversineMeters(origin, current);
    const remaining = haversineMeters(current, dest);
    return {
      pct: Math.min(100, Math.max(0, (traveled / total) * 100)),
      traveledKm: traveled / 1000,
      remainingKm: remaining / 1000,
    };
  })();

  const {} = usePlanePhoto(selected?.icao24);

  const flightDetailRows: [string, string | null][] = selected
    ? [
        ["Status", selected.flight_status],
        ["From", selected.origin_iata],
        ["To", selected.destination_iata],
        ["Dep (sched)", fmtSched(selected.scheduled_departure)],
        ["Arr (sched)", fmtSched(selected.scheduled_arrival)],
        ["ETA", eta],
        [
          "Forecast err",
          accuracyKm != null ? `${accuracyKm.toFixed(1)} km` : null,
        ],
        ["Altitude", ft(selected.baro_altitude)],
        [
          "Speed",
          typeof selected.velocity === "number"
            ? `${Math.round(selected.velocity * 1.944)} kts`
            : null,
        ],
        [
          "Heading",
          typeof selected.true_track === "number"
            ? `${Math.round(selected.true_track)}°`
            : null,
        ],
        [
          "Position",
          `${selected.latitude.toFixed(3)}, ${selected.longitude.toFixed(3)}`,
        ],
        ["Updated", timeAgo(selected.last_time_position) || null],
        // Trip-history extras (present once /api/history resolves for this trip).
        ["Max alt", history ? ft(history.max_altitude) : null],
        [
          "Max speed",
          typeof history?.max_velocity === "number"
            ? `${Math.round(history.max_velocity * 1.944)} kts`
            : null,
        ],
        ["Trip start", history ? fmtSched(history.trip_start_time) : null],
        ["Trip end", history ? fmtSched(history.trip_end_time) : null],
      ]
    : [];

  const aircraftDetailRows: [string, string | null][] = selected
    ? [
        ["Aircraft", selected.model],
        ["Type", selected.typecode],
        ["Maker", selected.manufacturername],
        ["Registration", selected.registration],
        ["Airline/Owner", selected.owner ?? selected.operator_callsign],
        ["ICAO24", selected.icao24],
        ["Country", selected.origin_country || null],
      ]
    : [];

  // Flights-list filter: case-insensitive substring across the fields a user
  // would search by. Empty query = everything.
  const q = query.trim().toLowerCase();
  const filteredPlanes = q
    ? planeList.filter((p) =>
        [
          p.callsign,
          p.owner,
          p.operator_callsign,
          p.origin_iata,
          p.destination_iata,
          p.icao24,
        ]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q))
      )
    : planeList;

  const aq = airportQuery.trim().toLowerCase();
  const filteredAirports = (
    aq
      ? airportList.filter((a) =>
          [a.name, a.iata_code, a.icao_code, a.iso_country]
            .filter(Boolean)
            .some((v) => (v as string).toLowerCase().includes(aq))
        )
      : airportList
  ).filter((a) => !a.name.startsWith("[Duplicate]"));

  return (
    <div
      className="relative h-screen w-screen"
      style={{ position: "relative", height: "100dvh", width: "100vw" }}
    >
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ position: "absolute", inset: 0 }}
      />

      <ChaosOverlay active={chaosMode} />
      <ConflictBadge conflictCount={conflictCount} />
      <ClockBadge nowWib={nowWib} />

      <BasemapSwitcher
        basemap={basemap}
        onSelectBasemap={selectBasemap}
        showPlanes={showPlanes}
        onTogglePlanes={togglePlanes}
        showAirports={showAirports}
        onToggleAirports={toggleAirports}
        showAltitudeColors={showAltitudeColors}
        onToggleAltitudeColors={toggleAltitudeColors}
      />

      <AltitudeLegend visible={showAltitudeColors} />

      <SidePanel
        panelTab={panelTab}
        onPanelTabChange={setPanelTab}
        listOpen={listOpen}
        onToggleListOpen={() => setListOpen((v) => !v)}
        planeList={planeList}
        filteredPlanes={filteredPlanes}
        query={query}
        onQueryChange={setQuery}
        sortDesc={sortDesc}
        onToggleSortDesc={() => setSortDesc((v) => !v)}
        selectedIcao24={selected?.icao24}
        onSelectPlane={selectPlane}
        airportList={airportList}
        filteredAirports={filteredAirports}
        airportQuery={airportQuery}
        onAirportQueryChange={setAirportQuery}
        selectedAirport={selectedAirport}
        onSelectAirport={selectAirportFromList}
      />

      {/* Detail sidebar for the selected plane. */}
      {selected && (
        <PlaneDetailSidebar
          selected={selected}
          history={history}
          follow={follow}
          onToggleFollow={toggleFollow}
          onClose={deselectPlane}
          sidebarTab={sidebarTab}
          onSidebarTabChange={setSidebarTab}
          flightDetailRows={flightDetailRows}
          aircraftDetailRows={aircraftDetailRows}
          progress={progress}
          eta={eta}
          replayT={replayT}
          onReplayTChange={setReplayT}
          replaying={replaying}
          onReplayingChange={setReplaying}
          timeAgoText={timeAgo}
          fmtSchedText={fmtSched}
        />
      )}

      {/* Detail sidebar for the selected airport. */}
      {selectedAirport && (
        <div className="absolute z-20 flex flex-col overflow-hidden bg-black/80 md:bg-black/70 text-xs text-white/85 backdrop-blur shadow-2xl transition-all bottom-0 left-0 w-full max-h-[50vh] rounded-t-xl border-t border-white/10 md:bottom-auto md:left-4 md:top-16 md:w-72 md:max-h-[calc(100dvh-5rem)] md:rounded-md md:border md:border-sky-400/20">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-white/10 px-3 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sky-400 text-base leading-none">✈</span>
                <span className="truncate text-sm font-semibold text-white">
                  {selectedAirport.name}
                </span>
              </div>
              {(selectedAirport.iata_code || selectedAirport.icao_code) && (
                <div className="mt-0.5 text-white/60">
                  {[selectedAirport.iata_code, selectedAirport.icao_code]
                    .filter(Boolean)
                    .join(" / ")}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={deselectAirport}
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
                  {selectedAirport.name}
                </span>
                {selectedAirport.iata_code && (
                  <span className="text-[10px] text-sky-300">
                    {selectedAirport.iata_code}
                  </span>
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
                ["IATA", selectedAirport.iata_code],
                ["ICAO", selectedAirport.icao_code],
                ["Country", selectedAirport.iso_country || null],
                [
                  "Type",
                  selectedAirport.type
                    ? selectedAirport.type
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase())
                    : null,
                ],
              ] as [string, string | null][]
            )
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between gap-3 px-3 py-1.5"
                >
                  <dt className="shrink-0 text-white/45">{label}</dt>
                  <dd className="truncate text-right text-white/90">{value}</dd>
                </div>
              ))}
          </dl>

          {/* ARRIVAL/DEPARTURE TABS */}
          <div className="flex border-b border-white/10 bg-white/5 shrink-0 text-[11px]">
            <button
              type="button"
              onClick={() => setAirportBoardTab("departure")}
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
              onClick={() => setAirportBoardTab("arrival")}
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
              <div className="px-3 py-4 text-center text-white/40">
                Loading…
              </div>
            )}
            {!scheduleLoading && schedule.length === 0 && (
              <div className="px-3 py-4 text-center text-white/40">
                No flights found.
              </div>
            )}
            {!scheduleLoading && schedule.length > 0 && (
              <ul className="divide-y divide-white/5">
                {schedule.map((s, i) => {
                  const time = fmtSched(s.sched_time);
                  const route = s.route_airport_iata ?? "???";
                  return (
                    <li
                      key={`${s.flight_no ?? s.callsign ?? i}-${
                        s.sched_time ?? i
                      }`}
                      className="flex flex-col gap-0.5 px-3 py-1.5"
                    >
                      {/* Row 1: Flight_no | Airline name */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-white/90">
                          {s.flight_no ?? s.callsign ?? "—"}
                        </span>
                        <span className="shrink-0 truncate text-white/50">
                          {s.airline_name ?? ""}
                        </span>
                      </div>
                      {/* Row 2: Time | Status */}
                      <div className="flex items-center justify-between gap-2 text-[10px]">
                        <span className="text-white/60">{time ?? "—"}</span>
                        {s.board_status && (
                          <span
                            className={`font-medium ${statusTextClass(
                              s.board_status
                            )}`}
                          >
                            {s.board_status}
                          </span>
                        )}
                      </div>
                      {/* Row 3: From | Target */}
                      <div className="flex items-center justify-between gap-2 text-[10px] text-white/45">
                        <span>
                          {airportBoardTab === "departure" ? "To" : "From"}
                        </span>
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
      <AttributionFooter />
    </div>
  );
}
