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
import { type Basemap, INDONESIA_BOUNDS } from "@/lib/mapConstants";
import { setBasemap } from "@/lib/mapStyle";
import { useFlightMapEngine } from "@/lib/hooks/useFlightMapEngine";
import { usePlanePhoto } from "@/lib/hooks/usePlanePhoto";
import { altitudeColorExpression } from "@/lib/altitudeColor";
import { DEFAULT_PLANE_COLOR } from "@/lib/mapConstants";

import ClockBadge from "@/components/flight-map/ClockBadge";
import TravelBadge from "@/components/flight-map/TravelBadge";
import ConflictBadge from "@/components/flight-map/ConflictBadge";
import ChaosOverlay from "@/components/flight-map/ChaosOverlay";
import AttributionFooter from "@/components/flight-map/AttributionFooter";
import BasemapSwitcher from "@/components/flight-map/BasemapSwitcher";
import SidePanel from "@/components/flight-map/SidePanel";
import PlaneDetailSidebar from "@/components/flight-map/PlaneDetailSidebar";
import AltitudeLegend from "@/components/flight-map/AltitudeLegend";
import AirportDetailSidebar from "@/components/flight-map/AirportDetailSidebar";
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
  const [basemap, setBasemapState] = useState<Basemap>("satellite");
  const [planeList, setPlaneList] = useState<StateVector[]>([]);
  const [airportList, setAirportList] = useState<Airport[]>([]);
  const [listOpen, setListOpen] = useState(true);
  // search panel airports
  const [panelTab, setPanelTab] = useState<"flights" | "airports">("flights");
  const [airportQuery, setAirportQuery] = useState("");
  const [showPlanes, setShowPlanes] = useState(true);
  const [showAltitudeColors, setShowAltitudeColors] = useState(true);
  const [showAirports, setShowAirports] = useState(true);
  // Free-text filter for the flights list.
  const [query, setQuery] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"flight" | "aircraft">("flight");
  // Where we predicted the selected plane would be by the next poll, so the next
  // poll can measure the forecast error. Plus the resulting error (km) for the HUD.
  const SHOW_CONFLICT_BADGE = false; // Set to true to re-enable
  // Latest planes, readable from the (once-registered) map click handler.
  const planesRef = useRef<StateVector[]>([]);
  // Wall-clock (ms) of the poll that produced `planesRef` — animation baseline.
  const baseTimeRef = useRef<number>(0);
  // Unix seconds timestamp of the last processed backend API update (from res.time).
  const lastApiTimeRef = useRef<number>(0);

  const [chaosMode, setChaosMode] = useState(false);

  function resetMapView() {
    const map = mapRef.current;
    if (!map) return;
    map.fitBounds(INDONESIA_BOUNDS, { padding: 20 });
  }

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
    setShowAltitudeColors((v) => !v);
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("planes")) return;
    if (chaosMode) return; // chaos mode owns the layer while active

    // ALWAYS force back to SDF — don't trust getLayoutProperty checks
    map.setLayoutProperty("planes", "icon-image", "plane-sdf");

    map.setPaintProperty(
      "planes",
      "icon-color",
      showAltitudeColors ? altitudeColorExpression() : DEFAULT_PLANE_COLOR
    );

    // Force MapLibre to redraw immediately
    map.triggerRepaint();
  }, [showAltitudeColors, chaosMode]);
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
      {SHOW_CONFLICT_BADGE && <ConflictBadge conflictCount={conflictCount} />}
      <ClockBadge nowWib={nowWib} />

      <TravelBadge onReset={resetMapView} />

      <BasemapSwitcher
        basemap={basemap}
        onSelectBasemap={selectBasemap}
        showPlanes={showPlanes}
        onTogglePlanes={togglePlanes}
        showAirports={showAirports}
        onToggleAirports={toggleAirports}
        showAltitudeColors={showAltitudeColors}
        onToggleAltitudeColors={toggleAltitudeColors}
        onOpen={() => {
          deselectPlane();
          deselectAirport();
        }}
      />

      <AltitudeLegend
        visible={showAltitudeColors}
        selectedAltitude={selected?.baro_altitude}
      />

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
        <AirportDetailSidebar
          airport={selectedAirport}
          onClose={deselectAirport}
          airportBoardTab={airportBoardTab}
          onAirportBoardTabChange={setAirportBoardTab}
          schedule={schedule}
          scheduleLoading={scheduleLoading}
          fmtSchedText={fmtSched}
          statusTextClassFn={statusTextClass}
        />
      )}
      <AttributionFooter />
    </div>
  );
}
