"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, {
  type StyleSpecification,
  type GeoJSONSource,
} from "maplibre-gl";
import { loadPlanes } from "@/lib/planes";
import { loadHistory } from "@/lib/history";
import { loadAirports } from "@/lib/airports";
import type { StateVector, TripHistory, Airport } from "@/lib/types";

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

type Basemap = "dark" | "satellite" | "streets";

// Which layers are visible for each basemap. Anything not listed is hidden.
// Custom text labels belong to Dark only — Satellite (ESRI reference) and
// Streets (OSM raster) already carry their own place names.
const DARK_LABELS = ["country-labels", "province-labels", "city-labels"];
const BASEMAP_LAYERS: Record<Basemap, string[]> = {
  dark: ["land", "land-outline", ...DARK_LABELS],
  satellite: ["sat", "sat-ref"],
  streets: ["osm"],
};

const ALL_BASEMAP_LAYERS = ["land", "land-outline", "sat", "sat-ref", "osm", ...DARK_LABELS];

function setBasemap(map: maplibregl.Map, mode: Basemap) {
  if (!map.isStyleLoaded()) return;
  const visible = new Set(BASEMAP_LAYERS[mode]);
  for (const id of ALL_BASEMAP_LAYERS) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", visible.has(id) ? "visible" : "none");
    }
  }
}

// Indonesia bounding box [west, south, east, north] — keeps the view (and the
// data we care about) scoped small.
const INDONESIA_BOUNDS: [number, number, number, number] = [94, -11, 141, 7];

// Plane marker asset (public/icons/plane.svg — a side-profile Nyan Cat facing
// RIGHT at rest). Aspect ~95:57. The art is a character, not a top-down plane,
// so we keep it upright and flip it horizontally toward the travel direction
// (see the `plane` / `plane-flip` images) rather than rotating the whole body.
const PLANE_ICON_SRC = "/icons/plane.png";
const PLANE_ICON_W = 40;
const PLANE_ICON_H = 40;

const SELECTED_PLANE_ICON_SRC = "/icons/plane-white.png";
const SELECTED_PLANE_ICON_W = 40;
const SELECTED_PLANE_ICON_H = 40;

// One style holds all three basemaps. Raster (satellite/streets) layers start
// hidden; MapLibre only fetches their tiles once made visible, so the default
// dark map stays tile-free and light. `planes` is added later, on top of all.
const BASE_STYLE: StyleSpecification = {
  version: 8,
  // Font glyphs so symbol layers can render text (MapLibre demo endpoint, no key).
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    world: {
      type: "geojson",
      data: "/data/world-110m.geojson",
    },
    places: {
      type: "geojson",
      data: "/data/id-places.geojson",
    },
    provinces: {
      type: "geojson",
      data: "/data/id-provinces.geojson",
    },
    // ESRI tiles are {z}/{y}/{x}; OSM is {z}/{x}/{y} — order differs, mind it.
    sat: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Imagery © Esri",
    },
    "sat-ref": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
    },
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    { id: "sea", type: "background", paint: { "background-color": "#0b1622" } },
    // Raster basemaps — hidden until selected.
    { id: "sat", type: "raster", source: "sat", layout: { visibility: "none" } },
    { id: "sat-ref", type: "raster", source: "sat-ref", layout: { visibility: "none" } },
    { id: "osm", type: "raster", source: "osm", layout: { visibility: "none" } },
    // Dark vector basemap — visible by default.
    {
      id: "land",
      type: "fill",
      source: "world",
      paint: { "fill-color": "#16283a" },
    },
    {
      id: "land-outline",
      type: "line",
      source: "world",
      paint: { "line-color": "#24425c", "line-width": 0.6 },
    },
    // Dark-only place labels (country / province / city). All share a dark halo.
    {
      id: "country-labels",
      type: "symbol",
      source: "world",
      layout: {
        "text-field": ["get", "NAME"],
        "text-font": ["Noto Sans Bold"],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.15,
        "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10, 6, 16],
      },
      paint: {
        "text-color": "#5f7d94",
        "text-halo-color": "#0b1622",
        "text-halo-width": 1.2,
      },
    },
    {
      id: "province-labels",
      type: "symbol",
      source: "provinces",
      minzoom: 4.5,
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 4.5, 10, 8, 15],
      },
      paint: {
        "text-color": "#8fb3cc",
        "text-halo-color": "#0b1622",
        "text-halo-width": 1.2,
      },
    },
    {
      id: "city-labels",
      type: "symbol",
      source: "places",
      minzoom: 5,
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        // Bigger cities (higher pop_max) get larger text.
        "text-size": [
          "interpolate",
          ["linear"],
          ["get", "pop_max"],
          50000, 10,
          2000000, 15,
        ],
        "text-anchor": "top",
        "text-offset": [0, 0.4],
      },
      paint: {
        "text-color": "#c6dae8",
        "text-halo-color": "#0b1622",
        "text-halo-width": 1.2,
      },
    },
  ],
};

function planesToGeoJSON(
  planes: StateVector[]
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: planes.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
      properties: {
        icao24: p.icao24,
        callsign: (p.callsign ?? "").trim() || "N/A",
        track: p.true_track ?? 0,
        baro_altitude: p.baro_altitude,
        velocity: p.velocity,
        on_ground: p.on_ground,
        origin_iata: p.origin_iata,
        destination_iata: p.destination_iata,
        model: p.model,
        typecode: p.typecode,
        registration: p.registration,
        owner: p.owner,
        flight_status: p.flight_status,
        last_time_position: p.last_time_position,
      },
    })),
  };
}

// Compact "updated Xm ago" from an ISO timestamp. Backend sends naive ISO
// (no tz) meaning UTC — append Z so it's not read as local. "" if null/invalid.
function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const withTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const ms = Date.parse(withTz);
  if (Number.isNaN(ms)) return "";
  const secs = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

// Parse an ISO position timestamp to unix seconds. Backend sends naive ISO
// (no tz) meaning UTC — append Z. NaN when null/invalid.
function posSecs(iso: string | null | undefined): number {
  if (!iso) return NaN;
  const withTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const ms = Date.parse(withTz);
  return Number.isNaN(ms) ? NaN : ms / 1000;
}

// Shortest signed angular difference a-b, normalized to [-180, 180] degrees.
function angDelta(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

// Great-circle (slerp) between two [lon,lat] points -> line coordinates.
// Unwraps longitude so a path near the antimeridian doesn't streak across the
// whole map. Used to draw a plane's path from its origin airport to current pos.
function greatCircle(
  a: [number, number],
  b: [number, number],
  steps = 128
): [number, number][] {
  const R = Math.PI / 180;
  const D = 180 / Math.PI;
  const lon1 = a[0] * R, lat1 = a[1] * R, lon2 = b[0] * R, lat2 = b[1] * R;
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
      )
    );
  if (d === 0) return [a, b];
  const pts: [number, number][] = [];
  let prevLon: number | null = null;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    const lat = Math.atan2(z, Math.hypot(x, y)) * D;
    let lon = Math.atan2(y, x) * D;
    if (prevLon !== null) {
      while (lon - prevLon > 180) lon -= 360;
      while (lon - prevLon < -180) lon += 360;
    }
    prevLon = lon;
    pts.push([lon, lat]);
  }
  return pts;
}

// Great-circle distance between two [lon,lat] points, in meters (haversine).
// Used for ETA (distance to destination / velocity).
function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const r = Math.PI / 180;
  const dLat = (b[1] - a[1]) * r;
  const dLon = (b[0] - a[0]) * r;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Point at fraction `t` (0..1) along a polyline, measured by great-circle
// segment length. Used by the flight-replay scrubber. Returns null if path empty.
function pointAlong(path: [number, number][], t: number): [number, number] | null {
  if (path.length === 0) return null;
  if (path.length === 1) return path[0];
  const segs = path.slice(1).map((p, i) => haversineMeters(path[i], p));
  const total = segs.reduce((a, b) => a + b, 0);
  if (total === 0) return path[0];
  let target = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i] || i === segs.length - 1) {
      const f = segs[i] === 0 ? 0 : target / segs[i];
      const a = path[i];
      const b = path[i + 1];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }
    target -= segs[i];
  }
  return path[path.length - 1];
}

// Project a point forward along a heading (dead reckoning) on a sphere.
// Used to animate airborne planes between polls. Returns the input unchanged
// when velocity/heading is unavailable. lon/lat in degrees, v in m/s.
function deadReckon(
  lon: number,
  lat: number,
  velocityMs: number | null,
  trackDeg: number | null,
  dtSec: number
): [number, number] {
  if (typeof velocityMs !== "number" || typeof trackDeg !== "number" || velocityMs <= 0) {
    return [lon, lat];
  }
  const R = 6371000; // earth radius, meters
  const d = (velocityMs * dtSec) / R; // angular distance
  const th = (trackDeg * Math.PI) / 180;
  const la1 = (lat * Math.PI) / 180;
  const lo1 = (lon * Math.PI) / 180;
  const la2 = Math.asin(
    Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(th)
  );
  const lo2 =
    lo1 +
    Math.atan2(
      Math.sin(th) * Math.sin(d) * Math.cos(la1),
      Math.cos(d) - Math.sin(la1) * Math.sin(la2)
    );
  return [(lo2 * 180) / Math.PI, (la2 * 180) / Math.PI];
}

// Forward-projected path from a live position over `horizonSec` seconds.
// Integrates in fine `stepSec` steps, rotating the heading by `turnRateDegPerSec`
// each step — so a turning plane's forecast bends into a circular arc instead of
// a straight line. Empty when velocity/heading unknown. Drives the yellow "next
// 2 min" prediction line of the selected plane.
function predictPath(
  lon: number,
  lat: number,
  velocityMs: number | null,
  trackDeg: number | null,
  turnRateDegPerSec = 0,
  horizonSec = 120,
  stepSec = 5
): [number, number][] {
  if (typeof velocityMs !== "number" || typeof trackDeg !== "number" || velocityMs <= 0) {
    return [];
  }
  const pts: [number, number][] = [];
  let pos: [number, number] = [lon, lat];
  let heading = trackDeg;
  for (let s = 0; s <= horizonSec; s += stepSec) {
    pts.push(pos);
    pos = deadReckon(pos[0], pos[1], velocityMs, heading, stepSec);
    heading += turnRateDegPerSec * stepSec;
  }
  return pts;
}

// Trim an ISO timestamp to "YYYY-MM-DD HH:MM" for display. Null-safe.
function fmtSched(iso: string | null): string | null {
  return iso ? iso.slice(0, 16).replace("T", " ") : null;
}

export default function FlightMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // IATA -> [lon, lat], loaded once from /data/airports.json. Origin of a
  // trajectory line comes from here (backend gives only origin_iata, not coords).
  const airportsRef = useRef<Record<string, [number, number]>>({});
  // State mirror of the airport lookup, for reads during render (ETA).
  const [airports, setAirports] = useState<Record<string, [number, number]>>({});
  const [basemap, setBasemapState] = useState<Basemap>("streets");
  const [planeList, setPlaneList] = useState<StateVector[]>([]);
  const [airportList, setAirportList] = useState<Airport[]>([]);
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
  const [listOpen, setListOpen] = useState(true);
  // search panel airports
  const [panelTab, setPanelTab] = useState<"flights" | "airports">("flights");
  const [airportQuery, setAirportQuery] = useState("");
  const [showPlanes, setShowPlanes] = useState(true);
  const [showAirports, setShowAirports] = useState(true);
  // Free-text filter for the flights list.
  const [query, setQuery] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"flight" | "aircraft">("flight");
  // Camera auto-follow of the selected plane. Ref mirrors state for the rAF loop.
  const [follow, setFollow] = useState(false);
  const followRef = useRef(false);
  // Count of converging plane pairs flagged by the near-miss radar.
  const [conflictCount, setConflictCount] = useState(0);
  // Where we predicted the selected plane would be by the next poll, so the next
  // poll can measure the forecast error. Plus the resulting error (km) for the HUD.
  const predictedRef = useRef<{ icao: string; lon: number; lat: number } | null>(null);
  const [accuracyKm, setAccuracyKm] = useState<number | null>(null);
  // Flight-replay scrubber: position (0..1) along the selected trip's recorded
  // path, and whether it's auto-playing.
  const [replayT, setReplayT] = useState(0);
  const [replaying, setReplaying] = useState(false);
  // Currently selected plane -> drives the detail sidebar.
  const [selected, setSelected] = useState<StateVector | null>(null);
  // Actual flown track for the selection (fetched lazily on select).
  const [history, setHistory] = useState<TripHistory | null>(null);
  // trip_id of the in-flight history fetch, to ignore stale resolutions.
  const historyTripRef = useRef<string | null>(null);
  // Latest planes, readable from the (once-registered) map click handler.
  const planesRef = useRef<StateVector[]>([]);
  // Wall-clock (ms) of the poll that produced `planesRef` — animation baseline.
  const baseTimeRef = useRef<number>(0);
  // Selected plane's icao24, readable inside the rAF closure (drives the live
  // trajectory head / prediction / label follow).
  const selectedIcaoRef = useRef<string | null>(null);
  // Flown/great-circle path BEHIND the plane (no live head point). The rAF loop
  // appends the current animated position so the line stays glued to the marker.
  const basePathRef = useRef<[number, number][]>([]);
  // Marker that replaces the static icon while selected.
  const selectedMarkerRef = useRef<maplibregl.Marker | null>(null);
  // Per-icao24 last heading sample + its timestamp, to derive turn rate.
  const prevTrackRef = useRef<Map<string, { track: number; t: number }>>(new Map());
  // Per-icao24 turn rate in signed deg/s (derived by diffing headings).
  const turnRateRef = useRef<Map<string, number>>(new Map());
  // True while showing the great-circle placeholder, before real history
  // arrives. Drives the dimmed/dashed "loading" style on the trajectory line.
  const trajectoryLoadingRef = useRef(false);

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
      selectedMarkerRef.current?.getElement().style.setProperty("display", "none");
    } else {
      selectedMarkerRef.current?.getElement().style.removeProperty("display");
    }
  }

  function toggleAirports() {
    const next = !showAirports;
    setShowAirports(next);
    const map = mapRef.current;
    if (!map) return;
    for (const id of ["airport-dot", "airport-label", "selected-airport-icon"]) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", next ? "visible" : "none");
      }
    }
  }

  // Clear any drawn trajectory (deselect).
  function clearTrajectory() {
    const src = mapRef.current?.getSource("trajectory") as
      | GeoJSONSource
      | undefined;
    src?.setData({ type: "FeatureCollection", features: [] });
  }

  // Render a path into the `trajectory` source: the rainbow line plus a dot at
  // its start.
  function setTrajectory(path: [number, number][]) {
    const map = mapRef.current;
    const src = map?.getSource("trajectory") as GeoJSONSource | undefined;
    if (!map || !src || path.length < 2) {
      clearTrajectory();
      return;
    }
    src.setData({
      type: "FeatureCollection",
      features: [
        { type: "Feature", geometry: { type: "LineString", coordinates: path }, properties: {} },
        { type: "Feature", geometry: { type: "Point", coordinates: path[0] }, properties: {} },
      ],
    });
  }

   function setTrajectoryLoading(loading: boolean) {
    trajectoryLoadingRef.current = loading;
    const map = mapRef.current;
    if (!map || !map.getLayer("trajectory-line")) return;
    map.setPaintProperty("trajectory-line", "line-opacity", loading ? 0.35 : 1);
    map.setPaintProperty(
      "trajectory-line",
      "line-dasharray",
      loading ? [0.6, 1.4] : undefined
    );
    map.setPaintProperty("trajectory-glow", "line-opacity", loading ? 0.12 : 0.3);
  }

  // Great-circle placeholder from the origin airport to the current position.
  function drawTrajectory(originIata: string | null, current: [number, number]) {
    const origin = originIata ? airportsRef.current[originIata] : undefined;
    if (!origin) {
      clearTrajectory();
      return;
    }
    setTrajectory(greatCircle(origin, current));
  }

  // Select a plane: open sidebar, draw the great-circle placeholder + fly to it,
  // then fetch the real flown path and replace the placeholder when it arrives.
  function selectPlane(p: StateVector) {
    const map = mapRef.current;
    setSelected(p);
    setSelectedAirport(null);
    setSidebarTab("flight");
    setHistory(null);
    historyTripRef.current = p.trip_id;
    selectedIcaoRef.current = p.icao24;
    predictedRef.current = null;
    setAccuracyKm(null);
    setReplaying(false);
    setReplayT(0);

    // Base path behind the plane: great-circle placeholder from origin airport
    // to current pos (replaced by the real flown path once /api/history lands).
    const origin = p.origin_iata ? airportsRef.current[p.origin_iata] : undefined;
    basePathRef.current = origin
      ? greatCircle(origin, [p.longitude, p.latitude])
      : [];
    drawTrajectory(p.origin_iata, [p.longitude, p.latitude]);
    setTrajectoryLoading(true);

    // Origin / destination airport pins (whichever resolve in the lookup).
    const endpointFeats: GeoJSON.Feature<GeoJSON.Point>[] = [];
    for (const iata of [p.origin_iata, p.destination_iata]) {
      const coord = iata ? airportsRef.current[iata] : undefined;
      if (coord) {
        endpointFeats.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: coord },
          properties: { iata },
        });
      }
    }
    (map?.getSource("endpoints") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: endpointFeats,
    });

    // Swap the static icon for the selected plane icon while selected: hide
    // this plane in the symbol layer and float an HTML marker in its place.
    selectedMarkerRef.current?.remove();
    if (map) {
      if (map.getLayer("planes")) {
        map.setFilter("planes", ["!=", ["get", "icao24"], p.icao24]);
      }
      const wrap = document.createElement("div");
      wrap.style.cssText = "pointer-events:none;line-height:0";
      const img = document.createElement("img");
      img.src = SELECTED_PLANE_ICON_SRC;
      img.alt = "";
      img.style.cssText = `height:${SELECTED_PLANE_ICON_H}px;width:${SELECTED_PLANE_ICON_W}px;display:block;`;
      wrap.appendChild(img);
      selectedMarkerRef.current = new maplibregl.Marker({ element: wrap, anchor: "center" })
        .setLngLat([p.longitude, p.latitude])
        .addTo(map);
    }

    // Draw the green dotted line to destination airport
    const destCoord = p.destination_iata ? airportsRef.current[p.destination_iata] : undefined;
    const destSrc = map?.getSource("destination-path") as GeoJSONSource | undefined;
    if (destSrc) {
      if (destCoord) {
        destSrc.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: greatCircle([p.longitude, p.latitude], destCoord),
              },
              properties: {},
            },
          ],
        });
      } else {
        destSrc.setData({ type: "FeatureCollection", features: [] });
      }
    }

    map?.flyTo({
      center: [p.longitude, p.latitude],
      zoom: Math.max(map.getZoom(), 7),
    });
    if (!p.trip_id) {
      setTrajectoryLoading(false);
      return;
    }
    loadHistory(p.trip_id)
      .then((h) => {
        // Ignore if the user has since selected another plane.
        if (historyTripRef.current !== p.trip_id) return;
        setHistory(h);
        if (h.path.length >= 2) {
          basePathRef.current = h.path;
          setTrajectory(h.path);
        }
        setTrajectoryLoading(false);
      })
      .catch((err) => {
        console.error("[history]", err);
        setTrajectoryLoading(false);
      });
  }

  // Deselect: close sidebar + clear trajectory, reset line style for next pick.
  function deselectPlane() {
    setSelected(null);
    setHistory(null);
    historyTripRef.current = null;
    selectedIcaoRef.current = null;
    basePathRef.current = [];
    setTrajectoryLoading(false);
    selectedMarkerRef.current?.remove();
    selectedMarkerRef.current = null;
    // Restore the static icon for the deselected plane.
    if (mapRef.current?.getLayer("planes")) {
      mapRef.current.setFilter("planes", null);
    }
    clearTrajectory();
    (mapRef.current?.getSource("destination-path") as GeoJSONSource | undefined)?.setData(
      { type: "FeatureCollection", features: [] }
    );
    (mapRef.current?.getSource("prediction") as GeoJSONSource | undefined)?.setData(
      { type: "FeatureCollection", features: [] }
    );
    (mapRef.current?.getSource("turn-marker") as GeoJSONSource | undefined)?.setData(
      { type: "FeatureCollection", features: [] }
    );
    (mapRef.current?.getSource("endpoints") as GeoJSONSource | undefined)?.setData(
      { type: "FeatureCollection", features: [] }
    );
    setFollow(false);
    followRef.current = false;
    predictedRef.current = null;
    setAccuracyKm(null);
    setReplaying(false);
    setReplayT(0);
  }

  // Select an airport from the sidebar list: mirrors the map's airport-dot
  // click handler (close the plane sidebar first, then fly to it).
    function selectAirportFromList(a: Airport) {
    deselectPlane();
    setSelectedAirport(a);
    const map = mapRef.current;
    if (map) {
      map.flyTo({
        center: [a.longitude_deg, a.latitude_deg],
        zoom: Math.max(map.getZoom(), 8),
      });
    }
  }

  // Derive each plane's turn rate (signed deg/s) by diffing its heading against
  // the previous sample. Clamped to ±3 deg/s (airliner standard-rate ceiling) to
  // reject heading jitter. Refreshes only when a newer position timestamp lands.
  function updateTurnRates(list: StateVector[]) {
    for (const p of list) {
      if (typeof p.true_track !== "number") continue;
      const t = posSecs(p.last_time_position);
      if (Number.isNaN(t)) continue;
      const prev = prevTrackRef.current.get(p.icao24);
      if (prev && t > prev.t) {
        const raw = angDelta(p.true_track, prev.track) / (t - prev.t);
        turnRateRef.current.set(p.icao24, Math.max(-3, Math.min(3, raw)));
      }
      prevTrackRef.current.set(p.icao24, { track: p.true_track, t });
    }
  }

  // Near-miss radar: flag airborne pairs whose 2-min forecasts pass within ~5nm
  // horizontally AND ~600m vertically. Draws a red link between their current
  // positions into the `conflicts` source and updates the count badge.
  function drawConflicts(list: StateVector[]) {
    const src = mapRef.current?.getSource("conflicts") as GeoJSONSource | undefined;
    if (!src) return;
    const air = list.filter(
      (p) =>
        !p.on_ground &&
        typeof p.velocity === "number" &&
        typeof p.true_track === "number"
    );
    const paths = air.map((p) => ({
      p,
      path: predictPath(
        p.longitude,
        p.latitude,
        p.velocity,
        p.true_track,
        turnRateRef.current.get(p.icao24) ?? 0
      ),
    }));
    const feats: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    for (let i = 0; i < paths.length; i++) {
      for (let j = i + 1; j < paths.length; j++) {
        const A = paths[i];
        const B = paths[j];
        const altA = A.p.baro_altitude;
        const altB = B.p.baro_altitude;
        if (typeof altA === "number" && typeof altB === "number" && Math.abs(altA - altB) > 600) {
          continue;
        }
        const n = Math.min(A.path.length, B.path.length);
        let min = Infinity;
        for (let k = 0; k < n; k++) {
          const d = haversineMeters(A.path[k], B.path[k]);
          if (d < min) min = d;
        }
        if (min < 9260) {
          feats.push({
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [
                [A.p.longitude, A.p.latitude],
                [B.p.longitude, B.p.latitude],
              ],
            },
            properties: {},
          });
        }
      }
    }
    src.setData({ type: "FeatureCollection", features: feats });
    setConflictCount(feats.length);
  }

  useEffect(() => {
    if (!containerRef.current) return;

    // Backend refreshes ~every 5 min; poll a bit tighter to catch updates.
    const POLL_MS = 120_000;
    let pollId: ReturnType<typeof setInterval> | undefined;
    let rafId: number | undefined;

    // Load the IATA->coords lookup once (used to anchor trajectory origins).
    fetch("/data/airports.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((j) => {
        airportsRef.current = j as Record<string, [number, number]>;
        setAirports(airportsRef.current);
      })
      .catch((err) => console.error("[airports-local]", err));

    // Shared promise so airports are fetched once and used for both the React
    // state (sidebar list, future features) and the MapLibre GeoJSON layer.
    const airportsPromise = loadAirports()
      .then((list) => { setAirportList(list); return list; })
      .catch((err) => { console.error("[airports-api]", err); return [] as Airport[]; });

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_STYLE,
      bounds: INDONESIA_BOUNDS,
      fitBoundsOptions: { padding: 20 },
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
    });
    mapRef.current = map;

    // Surface any WebGL/style/source failure that a blank map would hide.
    map.on("error", (e) => console.error("[map]", e?.error ?? e));

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new maplibregl.AttributionControl({
        customAttribution: "Basemap © Natural Earth (public domain)",
      })
    );

    map.on("load", async () => {
      // The container may have been 0-sized at construction (dev CSS-chunk
      // timing); re-measure now that layout is settled.
      map.resize();

      // Apply the default basemap (Streets) — the style ships with the dark
      // layers visible, so flip to the chosen default now that it's loaded.
      setBasemap(map, "streets");

      // Load the plane icon (SVG -> raster) before adding the symbol layer.
      const img = new Image(PLANE_ICON_W, PLANE_ICON_H);
      img.onload = async () => {
        if (!map.hasImage("plane")) {
          map.addImage("plane", img, { pixelRatio: 2 });
        }

         // Airport icons (unselected + selected states).
        const loadIcon = (src: string, name: string) =>
          new Promise<void>((resolve) => {
            const im = new Image();
            im.onload = () => {
              if (!map.hasImage(name)) map.addImage(name, im, { pixelRatio: 2 });
              resolve();
            };
            im.onerror = () => resolve(); // don't block plane load on a bad icon
            im.src = src;
          });
        await Promise.all([
          loadIcon("/icons/airport-unselected.png", "airport-unselected"),
          loadIcon("/icons/airport.png", "airport-selected"),
        ]);

        let planes: StateVector[] = [];
        try {
          planes = await loadPlanes();
        } catch (err) {
          console.error(err);
        }

        setPlaneList(planes);
        planesRef.current = planes;
        updateTurnRates(planes);
        baseTimeRef.current = Date.now();

        // Trajectory layers (added before `planes` so the plane icon sits on
        // top). One source holds the line + an origin dot; filters split them.
        map.addSource("trajectory", {
          type: "geojson",
          lineMetrics: true, // needed for the rainbow line-gradient
          data: { type: "FeatureCollection", features: [] },
        });
        // Soft white glow halo under the rainbow trail.
        map.addLayer({
          id: "trajectory-glow",
          type: "line",
          source: "trajectory",
          filter: ["==", ["geometry-type"], "LineString"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#ffffff",
            "line-width": 9,
            "line-blur": 8,
            "line-opacity": 0.3,
          },
        });
        // The flown path IS the Nyan rainbow — gradient sweep along the trail.
        map.addLayer({
          id: "trajectory-line",
          type: "line",
          source: "trajectory",
          filter: ["==", ["geometry-type"], "LineString"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-width": 4,
            "line-opacity": 1,
            "line-gradient": [
              "interpolate",
              ["linear"],
              ["line-progress"],
              0.0, "#ff2b2b",
              0.2, "#ff9500",
              0.4, "#ffe600",
              0.6, "#33dd33",
              0.8, "#00a3ff",
              1.0, "#8a2be2",
            ],
          },
        });
        // Neon start dot: glow halo + bright core.
        map.addLayer({
          id: "origin-glow",
          type: "circle",
          source: "trajectory",
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-radius": 11,
            "circle-color": "#22d3ee",
            "circle-blur": 1,
            "circle-opacity": 0.5,
          },
        });
        map.addLayer({
          id: "trajectory-origin",
          type: "circle",
          source: "trajectory",
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-radius": 4.5,
            "circle-color": "#e0fbff",
            "circle-stroke-color": "#0b1622",
            "circle-stroke-width": 1.5,
          },
        });

        // Forward "next 2 min" prediction of the selected plane — yellow dots.
        map.addSource("prediction", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "prediction-glow",
          type: "line",
          source: "prediction",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#facc15",
            "line-width": 7,
            "line-blur": 7,
            "line-opacity": 0.4,
          },
        });
        map.addLayer({
          id: "prediction-line",
          type: "line",
          source: "prediction",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#fde047",
            "line-width": 2,
            "line-dasharray": [0.4, 2],
            "line-opacity": 1,
          },
        });

        // Amber ring around the plane while it's turning (turn indicator).
        map.addSource("turn-marker", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "turn-marker-glow",
          type: "circle",
          source: "turn-marker",
          paint: {
            "circle-radius": 16,
            "circle-color": "#facc15",
            "circle-blur": 1,
            "circle-opacity": 0.35,
          },
        });
        map.addLayer({
          id: "turn-marker-ring",
          type: "circle",
          source: "turn-marker",
          paint: {
            "circle-radius": 13,
            "circle-opacity": 0,
            "circle-stroke-color": "#fde047",
            "circle-stroke-width": 2,
          },
        });

        // Green dotted path from current position to destination airport.
        map.addSource("destination-path", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "destination-line",
          type: "line",
          source: "destination-path",
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#10b981", // Emerald green
            "line-width": 3.5,
            "line-dasharray": [0.01, 2], // Circular dots when combined with round line-cap
            "line-opacity": 0.85,
          },
        });

        // Origin / destination airport pins for the selected flight.
        map.addSource("endpoints", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "endpoint-dot",
          type: "circle",
          source: "endpoints",
          paint: {
            "circle-radius": 5,
            "circle-color": "#ffffff",
            "circle-stroke-color": "#0b1622",
            "circle-stroke-width": 2,
          },
        });
        map.addLayer({
          id: "endpoint-label",
          type: "symbol",
          source: "endpoints",
          layout: {
            "text-field": ["get", "iata"],
            "text-font": ["Noto Sans Bold"],
            "text-size": 12,
            "text-offset": [0, -1.1],
            "text-anchor": "bottom",
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "#0b1622",
            "text-halo-width": 1.4,
          },
        });

        // Near-miss radar: red links between pairs of planes whose 2-min
        // forecasts converge (pulsed in the rAF loop).
        map.addSource("conflicts", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "conflict-glow",
          type: "line",
          source: "conflicts",
          layout: { "line-cap": "round" },
          paint: { "line-color": "#ff3b3b", "line-width": 8, "line-blur": 8, "line-opacity": 0.4 },
        });
        map.addLayer({
          id: "conflict-line",
          type: "line",
          source: "conflicts",
          layout: { "line-cap": "round" },
          paint: {
            "line-color": "#ff5555",
            "line-width": 2,
            "line-dasharray": [1, 1],
            "line-opacity": 0.9,
          },
        });
        drawConflicts(planes);

        // Flight-replay head: a marker scrubbed along the selected trip's path.
        map.addSource("replay", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "replay-glow",
          type: "circle",
          source: "replay",
          paint: { "circle-radius": 12, "circle-color": "#ffffff", "circle-blur": 1, "circle-opacity": 0.4 },
        });
        map.addLayer({
          id: "replay-dot",
          type: "circle",
          source: "replay",
          paint: {
            "circle-radius": 6,
            "circle-color": "#ffffff",
            "circle-stroke-color": "#8a2be2",
            "circle-stroke-width": 2,
          },
        });

        // Airport markers — rendered before planes so planes sit on top.
        // Circle (dot) + IATA label. Uses the shared airportsPromise (one fetch
        // for both this layer and the React state list).
        airportsPromise
          .then((list) => {
            if (!map.getSource("airports")) {
              map.addSource("airports", {
                type: "geojson",
                data: {
                  type: "FeatureCollection",
                  features: list.map((a) => ({
                    type: "Feature" as const,
                    geometry: {
                      type: "Point" as const,
                      coordinates: [a.longitude_deg, a.latitude_deg],
                    },
                    properties: {
                      name: a.name,
                      iata: a.iata_code ?? "",
                      icao: a.icao_code ?? "",
                      country: a.iso_country,
                      type: a.type,
                    },
                  })),
                },
              });

              // Core dot.
             map.addLayer({
                id: "airport-dot",
                type: "symbol",
                source: "airports",
                minzoom: 4,
                layout: {
                  "icon-image": "airport-unselected",
                  "icon-size": ["interpolate", ["linear"], ["zoom"], 4, 0.15, 10, 0.3],
                  "icon-allow-overlap": true,
                  "icon-ignore-placement": true,
                },
              });

              // IATA label — only shown when an IATA code is present.
              map.addLayer({
                id: "airport-label",
                type: "symbol",
                source: "airports",
                minzoom: 6,
                filter: ["!=", ["get", "iata"], ""],
                layout: {
                  "text-field": ["get", "iata"],
                  "text-font": ["Noto Sans Bold"],
                  "text-size": 10,
                  "text-offset": [0, -1.4],
                  "text-anchor": "bottom",
                  "text-allow-overlap": false,
                  "text-ignore-placement": false,
                },
                paint: {
                  "text-color": "#bae6fd",
                  "text-halo-color": "#0b1622",
                  "text-halo-width": 1.2,
                },
              });
              
                map.addSource("selected-airport", {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
              });
              map.addLayer({
                id: "selected-airport-icon",
                type: "symbol",
                source: "selected-airport",
                layout: {
                  "icon-image": "airport-selected",
                  "icon-size": ["interpolate", ["linear"], ["zoom"], 4, 0.45, 10, 0.75],
                  "icon-allow-overlap": true,
                  "icon-ignore-placement": true,
                },
              });

              // Click an airport dot -> open the airport detail sidebar.
              map.on("click", "airport-dot", (e) => {
                // Stop propagation so the map's generic click (deselectPlane) doesn't fire.
                e.preventDefault();
                const f = e.features?.[0];
                if (!f) return;
                const props = f.properties as {
                  name: string;
                  iata: string;
                  icao: string;
                  country: string;
                  type: string;
                };
                const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
                // Close the plane sidebar first so the two panels never overlap.
                deselectPlane();
                setSelectedAirport({
                  name: props.name,
                  iata_code: props.iata || null,
                  icao_code: props.icao || null,
                  iso_country: props.country,
                  type: props.type,
                  longitude_deg: coords[0],
                  latitude_deg: coords[1],
                });
                map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 8) });
              });
              map.on("mouseenter", "airport-dot", () => {
                map.getCanvas().style.cursor = "pointer";
              });
              map.on("mouseleave", "airport-dot", () => {
                map.getCanvas().style.cursor = "";
              });
            }
          })
          .catch((err) => console.error("[airports-layer]", err));

        map.addSource("planes", {
          type: "geojson",
          data: planesToGeoJSON(planes),
        });

        map.addLayer({
          id: "planes",
          type: "symbol",
          source: "planes",
          layout: {
            "icon-image": "plane",
            // Since the plane icon points 45 degrees (NE) at rest, we rotate by (track - 45)
            "icon-rotate": ["-", ["get", "track"], 45],
            // Zoom-aware, clamped so the marker stays readable — never tiny far
            // out, never oversized zoomed in.
            "icon-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              4, 0.6,
              7, 0.9,
              10, 1.2,
              13, 1.5,
            ],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
          },
        });

         airportsPromise.then(() => {
          if (map.getLayer("planes")) {
            map.moveLayer("planes"); // no beforeId = move to very top
          }
        });

        // Click a plane -> open the detail sidebar + trajectory. Resolve the
        // full record from the latest poll (GeoJSON props are lossy).
        map.on("click", "planes", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const icao = f.properties?.icao24;
          const full =
            typeof icao === "string"
              ? planesRef.current.find((p) => p.icao24 === icao)
              : undefined;
          if (full) {
            // Close the airport sidebar first so the two panels never overlap.
            setSelectedAirport(null);
            selectPlane(full);
          }
        });

        // Click empty map (no plane or airport under cursor) -> deselect (close sidebars).
        map.on("click", (e) => {
          const hits = map.queryRenderedFeatures(e.point, { layers: ["planes", "airport-dot"] });
          if (!hits.length) {
            deselectPlane();
            setSelectedAirport(null);
          }
        });
        map.on("mouseenter", "planes", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "planes", () => {
          map.getCanvas().style.cursor = "";
        });

        // Animate: project airborne planes forward from the last poll along
        // their heading, so markers glide instead of teleporting each cycle.
        // Sole writer of the `planes` source. Throttled to ~10 fps.
        let lastDraw = 0;
        const animate = () => {
          rafId = requestAnimationFrame(animate);
          const now = performance.now();
          if (now - lastDraw < 100) return;
          lastDraw = now;
          const src = map.getSource("planes") as GeoJSONSource | undefined;
          if (!src) return;
          const dt = (Date.now() - baseTimeRef.current) / 1000;
          const moved = planesRef.current.map((p) => {
            if (p.on_ground) return p;
            const [lng, lat] = deadReckon(
              p.longitude,
              p.latitude,
              p.velocity,
              p.true_track,
              dt
            );
            return { ...p, longitude: lng, latitude: lat };
          });
          src.setData(planesToGeoJSON(moved));

          // Keep the selected plane's trajectory head, prediction, and label
          // glued to its live animated position (no lag behind the marker).
          const selIcao = selectedIcaoRef.current;
          if (!selIcao) return;
          const sel = moved.find((p) => p.icao24 === selIcao);
          if (!sel) return;
          const head: [number, number] = [sel.longitude, sel.latitude];

          // Auto-follow: keep the plane centered while the toggle is on.
          if (followRef.current) map.setCenter(head);

          const traj = map.getSource("trajectory") as GeoJSONSource | undefined;
          const base = basePathRef.current;
          if (traj && base.length >= 1) {
            traj.setData({
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  geometry: { type: "LineString", coordinates: [...base, head] },
                  properties: {},
                },
                {
                  type: "Feature",
                  geometry: { type: "Point", coordinates: base[0] },
                  properties: {},
                },
              ],
            });
          }

          // Update the green dotted path to the destination airport using the live animated head position
          const destIata = sel.destination_iata;
          const destCoord = destIata ? airportsRef.current[destIata] : undefined;
          const destSrc = map.getSource("destination-path") as GeoJSONSource | undefined;
          if (destSrc) {
            if (destCoord) {
              destSrc.setData({
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    geometry: {
                      type: "LineString",
                      coordinates: greatCircle(head, destCoord),
                    },
                    properties: {},
                  },
                ],
              });
            } else {
              destSrc.setData({ type: "FeatureCollection", features: [] });
            }
          }

          const omega = turnRateRef.current.get(selIcao) ?? 0;
          const pred = map.getSource("prediction") as GeoJSONSource | undefined;
          const ppath = sel.on_ground
            ? []
            : predictPath(sel.longitude, sel.latitude, sel.velocity, sel.true_track, omega);
          pred?.setData({
            type: "FeatureCollection",
            features:
              ppath.length >= 2
                ? [
                    {
                      type: "Feature",
                      geometry: { type: "LineString", coordinates: ppath },
                      properties: {},
                    },
                  ]
                : [],
          });

          // Turn indicator: ring on the plane while it's meaningfully turning.
          const turning = !sel.on_ground && Math.abs(omega) >= 0.15;
          const turnSrc = map.getSource("turn-marker") as GeoJSONSource | undefined;
          turnSrc?.setData({
            type: "FeatureCollection",
            features: turning
              ? [{ type: "Feature", geometry: { type: "Point", coordinates: head }, properties: {} }]
              : [],
          });

          // Selected plane marker follows the plane and rotates so its head points
          // along the heading. The art points 45 degrees (NE) at rest; rotate by track-45.
          const selectedMarker = selectedMarkerRef.current;
          if (selectedMarker) {
            selectedMarker.setLngLat(head);
            const imgEl = selectedMarker.getElement().firstElementChild as HTMLElement | null;
            if (imgEl) {
              const h = sel.true_track;
              if (typeof h === "number") {
                imgEl.style.transform = `rotate(${h - 45}deg)`;
              } else {
                imgEl.style.transform = "none";
              }
            }
          }
        };
        rafId = requestAnimationFrame(animate);

        // Poll the backend and re-baseline the animation (no direct setData —
        // the rAF loop owns the source).
        pollId = setInterval(async () => {
          try {
            const next = await loadPlanes();
            setPlaneList(next);
            planesRef.current = next;
            updateTurnRates(next);
            drawConflicts(next);
            baseTimeRef.current = Date.now();

            // Prediction accuracy: score last poll's forecast for the selected
            // plane against its actual new position, then forecast the next poll.
            const selIcao = selectedIcaoRef.current;
            const actual = selIcao ? next.find((p) => p.icao24 === selIcao) : undefined;
            if (actual) {
              const pr = predictedRef.current;
              if (pr && pr.icao === selIcao) {
                setAccuracyKm(
                  haversineMeters([actual.longitude, actual.latitude], [pr.lon, pr.lat]) / 1000
                );
              }
              if (typeof actual.velocity === "number" && typeof actual.true_track === "number") {
                const omega = turnRateRef.current.get(selIcao!) ?? 0;
                const pth = predictPath(
                  actual.longitude,
                  actual.latitude,
                  actual.velocity,
                  actual.true_track,
                  omega,
                  POLL_MS / 1000,
                  10
                );
                const end = pth[pth.length - 1];
                predictedRef.current = { icao: selIcao!, lon: end[0], lat: end[1] };
              } else {
                predictedRef.current = null;
              }
            }

            // Keep the open sidebar in sync with the freshest data.
            setSelected((prev) =>
              prev ? next.find((p) => p.icao24 === prev.icao24) ?? prev : null
            );
          } catch (err) {
            console.error(err); // keep last-known planes on a failed poll
          }
        }, POLL_MS);
      };
      img.src = PLANE_ICON_SRC;
    });

    return () => {
      if (pollId) clearInterval(pollId);
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      map.remove();
      mapRef.current = null;
    };
    // Map is created once; select/deselect read only stable refs + setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw the replay head at the current scrub position along the selected trip's
  // recorded path (empty when there's no path).
  useEffect(() => {
    const src = mapRef.current?.getSource("replay") as GeoJSONSource | undefined;
    if (!src) return;
    const path = history?.path;
    const pt = path && path.length >= 2 ? pointAlong(path, replayT) : null;
    src.setData({
      type: "FeatureCollection",
      features: pt
        ? [{ type: "Feature", geometry: { type: "Point", coordinates: pt }, properties: {} }]
        : [],
    });
  }, [replayT, history]);

  // Highlight the selected airport on the map — swap its icon and hide the
  // base marker underneath, mirroring the selected-plane icon swap.
  useEffect(() => {
    const map = mapRef.current;
    const src = map?.getSource("selected-airport") as GeoJSONSource | undefined;
    if (!map || !src) return;

    if (map.getLayer("airport-dot")) {
      map.setFilter(
        "airport-dot",
        selectedAirport ? ["!=", ["get", "icao"], selectedAirport.icao_code ?? ""] : null
      );
    }

    src.setData({
      type: "FeatureCollection",
      features: selectedAirport
        ? [
            {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [selectedAirport.longitude_deg, selectedAirport.latitude_deg],
              },
              properties: {},
            },
          ]
        : [],
    });
  }, [selectedAirport]);

  // Auto-play the replay: advance the scrubber ~5s end-to-end, stop at the end.
  useEffect(() => {
    if (!replaying) return;
    const id = setInterval(() => {
      setReplayT((t) => {
        const nt = t + 0.02;
        if (nt >= 1) {
          setReplaying(false);
          return 1;
        }
        return nt;
      });
    }, 100);
    return () => clearInterval(id);
  }, [replaying]);

  const modes: { id: Basemap; label: string }[] = [
    { id: "streets", label: "Streets" },
    { id: "dark", label: "Dark" },
    { id: "satellite", label: "Satellite" },
  ];

  // Label/value rows for the detail sidebar (nulls filtered out at render).
  const ft = (m: number | null) =>
    typeof m === "number" ? `${Math.round(m * 3.281).toLocaleString()} ft` : null;

  // ETA to destination: great-circle distance to the dest airport / ground speed,
  // shown as remaining time "1h 23m". Null if destination/speed unknown.
  const eta = ((): string | null => {
    const dest = selected?.destination_iata
      ? airports[selected.destination_iata]
      : undefined;
    if (!selected || !dest || typeof selected.velocity !== "number" || selected.velocity <= 0) {
      return null;
    }
    const secs = haversineMeters([selected.longitude, selected.latitude], dest) / selected.velocity;
    if (!Number.isFinite(secs)) return null;
    const h = Math.floor(secs / 3600);
    const m = Math.round((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  })();

  // Flight progress: % of great-circle distance traveled from origin to
  // current position, out of total origin→destination distance.
  const progress = ((): { pct: number; traveledKm: number; remainingKm: number } | null => {
    if (!selected) return null;
    const origin = selected.origin_iata ? airports[selected.origin_iata] : undefined;
    const dest = selected.destination_iata ? airports[selected.destination_iata] : undefined;
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

  const flightDetailRows: [string, string | null][] = selected
    ? [
        ["Status", selected.flight_status],
        ["From", selected.origin_iata],
        ["To", selected.destination_iata],
        ["Dep (sched)", fmtSched(selected.scheduled_departure)],
        ["Arr (sched)", fmtSched(selected.scheduled_arrival)],
        ["ETA", eta],
        ["Forecast err", accuracyKm != null ? `${accuracyKm.toFixed(1)} km` : null],
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
        ["Position", `${selected.latitude.toFixed(3)}, ${selected.longitude.toFixed(3)}`],
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
  const filteredAirports = (aq
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
      {conflictCount > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full border border-red-400/40 bg-red-950/70 px-3 py-1 text-xs font-semibold text-red-200 backdrop-blur">
          ⚠ {conflictCount} near-miss {conflictCount === 1 ? "pair" : "pairs"}
        </div>
      )}
      <div className="absolute left-4 top-4 z-10 flex overflow-hidden rounded-md border border-white/10 bg-black/50 text-xs font-medium backdrop-blur">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => selectBasemap(m.id)}
            className={`px-3 py-1.5 transition-colors ${
              basemap === m.id
                ? "bg-white/90 text-black"
                : "text-white/80 hover:bg-white/10"
            }`}
          >
            {m.label}
          </button>
        ))}

        <button
          type="button"
          onClick={togglePlanes}
          className={`px-3 py-1.5 transition-colors ${
            showPlanes ? "bg-white/90 text-black" : "text-white/80 hover:bg-white/10"
          }`}
        >
          ✈ 
        </button>
        <button
          type="button"
          onClick={toggleAirports}
          className={`px-3 py-1.5 transition-colors ${
            showAirports ? "bg-white/90 text-black" : "text-white/80 hover:bg-white/10"
          }`}
        >
          🏢 
        </button>
      </div>
      

      {/* Floating list of planes currently on the map. */}
     {/* Floating list of planes/airports currently on the map. */}
      <div className="absolute right-4 top-4 z-10 flex max-h-[calc(100dvh-2rem)] w-64 flex-col overflow-hidden rounded-md border border-white/10 bg-black/55 text-xs backdrop-blur">
        <div className="flex items-stretch">
          <button
            type="button"
            onClick={() => setPanelTab("flights")}
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
            onClick={() => setPanelTab("airports")}
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
            onClick={() => setListOpen((v) => !v)}
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
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search callsign / airline / route…"
                className="flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-white/90 placeholder:text-white/35 focus:border-white/25 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSortDesc((v) => !v)}
                title={sortDesc ? "Sorting: Newest First (Desc)" : "Sorting: Oldest First (Asc)"}
                className="rounded border border-white/10 bg-white/5 px-2 py-1 text-white/90 hover:bg-white/10 hover:border-white/25 focus:outline-none flex items-center justify-center font-medium shrink-0 min-w-[2.5rem]"
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
                        onClick={() => selectPlane(p)}
                        className={`flex w-full flex-col gap-0.5 px-3 py-1.5 text-left hover:bg-white/10 ${
                          selected?.icao24 === p.icao24 ? "bg-sky-500/20" : ""
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
                          <span className="shrink-0 text-white/50">{alt} · {spd}</span>
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
                onChange={(e) => setAirportQuery(e.target.value)}
                placeholder="Search names …"
                className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-white/90 placeholder:text-white/35 focus:border-white/25 focus:outline-none"
              />
            </div>    
            <ul className="divide-y divide-white/5 overflow-y-auto">
              {filteredAirports.map((a, i) => (
                    <li key={`${a.icao_code ?? a.iata_code ?? a.name}-${a.latitude_deg}-${a.longitude_deg}-${i}`}>                  <button
                    type="button"
                    onClick={() => selectAirportFromList(a)}
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

      {/* Detail sidebar for the selected plane. */}
      {selected && (
        <div className="absolute left-4 top-16 z-10 flex max-h-[calc(100dvh-5rem)] w-72 flex-col overflow-hidden rounded-md border border-white/10 bg-black/70 text-xs text-white/85 backdrop-blur">
          <div className="flex items-start justify-between gap-2 border-b border-white/10 px-3 py-2">
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
                  {selected.origin_iata ?? "???"} → {selected.destination_iata ?? "???"}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const v = !follow;
                  setFollow(v);
                  followRef.current = v;
                }}
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
                onClick={deselectPlane}
                aria-label="Close"
                className="rounded px-1.5 text-base leading-none text-white/60 hover:bg-white/10 hover:text-white"
              >
                ×
              </button>
            </div>
          </div>
          <div className="flex border-b border-white/10 bg-white/5 shrink-0 text-[11px]">
            <button
              type="button"
              onClick={() => setSidebarTab("flight")}
              className={`flex-1 py-1.5 text-center font-medium border-b-2 transition-all focus:outline-none ${
                sidebarTab === "flight"
                  ? "border-sky-500 text-white bg-white/5"
                  : "border-transparent text-white/50 hover:text-white/80"
              }`}
            >
              Flight
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab("aircraft")}
              className={`flex-1 py-1.5 text-center font-medium border-b-2 transition-all focus:outline-none ${
                sidebarTab === "aircraft"
                  ? "border-sky-500 text-white bg-white/5"
                  : "border-transparent text-white/50 hover:text-white/80"
              }`}
            >
              Aircraft
            </button>
          </div>
          
          {/* ↓ ADD THIS CARD ↓ */}
          {sidebarTab === "flight" && (
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
                <span>Sched {fmtSched(selected.scheduled_departure) ?? "—"}</span>
                <span>Sched {fmtSched(selected.scheduled_arrival) ?? "—"}</span>
              </div>
              {progress && (
                <>
                  <div className="relative mt-3 h-1 rounded-full bg-white/10">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-amber-400"
                      style={{ width: `${progress.pct}%` }}
                    />
                    <span
                      className="absolute -top-[7px] -translate-x-1/2 text-[13px]"
                      style={{ left: `${progress.pct}%` }}
                    >
                      ✈
                    </span>
                  </div>
                  <div className="mt-1.5 flex justify-between text-[10px] text-white/45">
                    <span>
                      {Math.round(progress.traveledKm).toLocaleString()} km
                      {timeAgo(selected.last_time_position)
                        ? ` · ${timeAgo(selected.last_time_position)}`
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
          )}

          {sidebarTab === "aircraft" && (
            <div className="px-3 pt-3 pb-2 border-b border-white/5 bg-white/5 shrink-0">
              <div className="relative aspect-video w-full overflow-hidden rounded border border-white/10 bg-black/40">
                <img
                  src="/images/plane-placeholder.png"
                  alt="Aircraft"
                  className="w-full h-full object-cover opacity-85"
                />
                <div className="absolute bottom-1 right-2 rounded bg-black/60 px-1 text-[9px] text-white/50">
                  Placeholder Photo
                </div>
              </div>
            </div>
          )}
          {sidebarTab === "flight" && history && history.path.length >= 2 && (
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
              <button
                type="button"
                onClick={() => {
                  if (replayT >= 1) setReplayT(0);
                  setReplaying((v) => !v);
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
                  setReplaying(false);
                  setReplayT(Number(e.target.value));
                }}
                className="h-1 w-full cursor-pointer accent-fuchsia-500"
              />
            </div>
          )}
          <dl className="divide-y divide-white/5 overflow-y-auto">
            {(sidebarTab === "flight" ? flightDetailRows : aircraftDetailRows)
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 px-3 py-1.5">
                  <dt className="shrink-0 text-white/45">{label}</dt>
                  <dd className="truncate text-right text-white/90">{value}</dd>
                </div>
              ))}
          </dl>
        </div>
      )}
      {/* Detail sidebar for the selected airport. */}
      {selectedAirport && (
        <div className="absolute left-4 top-16 z-10 flex max-h-[calc(100dvh-5rem)] w-72 flex-col overflow-hidden rounded-md border border-sky-400/20 bg-black/70 text-xs text-white/85 backdrop-blur">
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
                  {[selectedAirport.iata_code, selectedAirport.icao_code].filter(Boolean).join(" / ")}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedAirport(null)}
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
              <div className="absolute inset-0 flex flex-col justify-end p-2 bg-gradient-to-t from-black/70 via-transparent">
                <span className="text-[11px] font-semibold text-white leading-tight">
                  {selectedAirport.name}
                </span>
                {selectedAirport.iata_code && (
                  <span className="text-[10px] text-sky-300">{selectedAirport.iata_code}</span>
                )}
              </div>
              <div className="absolute top-1 right-2 rounded bg-black/60 px-1 text-[9px] text-white/50">
                Placeholder Photo
              </div>
            </div>
          </div>

          {/* Info rows */}
          <dl className="divide-y divide-white/5 overflow-y-auto">
            {([
              ["IATA",    selectedAirport.iata_code],
              ["ICAO",    selectedAirport.icao_code],
              ["Country", selectedAirport.iso_country || null],
              ["Type",    selectedAirport.type
                ? selectedAirport.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                : null],
            ] as [string, string | null][])
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 px-3 py-1.5">
                  <dt className="shrink-0 text-white/45">{label}</dt>
                  <dd className="truncate text-right text-white/90">{value}</dd>
                </div>
              ))}
          </dl>
        </div>
      )}
    </div>
  );
}
