"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, {
  type StyleSpecification,
  type GeoJSONSource,
} from "maplibre-gl";
import { loadPlanes } from "@/lib/planes";
import type { StateVector } from "@/lib/types";

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

// Plane marker asset (public/icons/plane.svg). Aspect ~95:57.
// icon-rotate uses `true_track` (deg clockwise from north). If the art's nose
// does not point up at rest, adjust PLANE_ICON_ROTATE_OFFSET below.
const PLANE_ICON_SRC = "/icons/plane.svg";
const PLANE_ICON_W = 48;
const PLANE_ICON_H = 29;
const PLANE_ICON_ROTATE_OFFSET = 0; // e.g. -90 if art faces east at rest

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
  const [basemap, setBasemapState] = useState<Basemap>("streets");
  const [planeList, setPlaneList] = useState<StateVector[]>([]);
  const [listOpen, setListOpen] = useState(true);
  // Currently selected plane -> drives the detail sidebar.
  const [selected, setSelected] = useState<StateVector | null>(null);
  // Latest planes, readable from the (once-registered) map click handler.
  const planesRef = useRef<StateVector[]>([]);

  function selectBasemap(mode: Basemap) {
    setBasemapState(mode);
    const map = mapRef.current;
    if (map) setBasemap(map, mode);
  }

  // Clear any drawn trajectory (deselect).
  function clearTrajectory() {
    const src = mapRef.current?.getSource("trajectory") as
      | GeoJSONSource
      | undefined;
    src?.setData({ type: "FeatureCollection", features: [] });
  }

  // Draw a great-circle path from the origin airport to the plane's current
  // position, plus a dot at the origin. Clears if the origin IATA is unknown.
  function drawTrajectory(
    originIata: string | null,
    current: [number, number]
  ) {
    const src = mapRef.current?.getSource("trajectory") as
      | GeoJSONSource
      | undefined;
    if (!src) return;
    const origin = originIata ? airportsRef.current[originIata] : undefined;
    if (!origin) {
      clearTrajectory();
      return;
    }
    src.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "LineString", coordinates: greatCircle(origin, current) },
          properties: {},
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: origin },
          properties: {},
        },
      ],
    });
  }

  // Select a plane: open the detail sidebar, draw its trajectory, fly to it.
  function selectPlane(p: StateVector) {
    setSelected(p);
    drawTrajectory(p.origin_iata, [p.longitude, p.latitude]);
    mapRef.current?.flyTo({
      center: [p.longitude, p.latitude],
      zoom: Math.max(mapRef.current.getZoom(), 7),
    });
  }

  // Deselect: close sidebar + clear trajectory.
  function deselectPlane() {
    setSelected(null);
    clearTrajectory();
  }

  useEffect(() => {
    if (!containerRef.current) return;

    // Backend refreshes ~every 5 min; poll a bit tighter to catch updates.
    const POLL_MS = 120_000;
    let pollId: ReturnType<typeof setInterval> | undefined;

    // Load the IATA->coords lookup once (used to anchor trajectory origins).
    fetch("/data/airports.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((j) => {
        airportsRef.current = j as Record<string, [number, number]>;
      })
      .catch((err) => console.error("[airports]", err));

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

        let planes: StateVector[] = [];
        try {
          planes = await loadPlanes();
        } catch (err) {
          console.error(err);
        }

        setPlaneList(planes);
        planesRef.current = planes;

        // Trajectory layers (added before `planes` so the plane icon sits on
        // top). One source holds the line + an origin dot; filters split them.
        map.addSource("trajectory", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "trajectory-line",
          type: "line",
          source: "trajectory",
          filter: ["==", ["geometry-type"], "LineString"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#38bdf8",
            "line-width": 2,
            "line-dasharray": [2, 1.5],
            "line-opacity": 0.9,
          },
        });
        map.addLayer({
          id: "trajectory-origin",
          type: "circle",
          source: "trajectory",
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-radius": 4,
            "circle-color": "#38bdf8",
            "circle-stroke-color": "#0b1622",
            "circle-stroke-width": 1.5,
          },
        });

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
            "icon-size": 0.6,
            "icon-rotate": ["+", ["get", "track"], PLANE_ICON_ROTATE_OFFSET],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
          },
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
          if (full) selectPlane(full);
        });

        // Click empty map (no plane under cursor) -> deselect (close sidebar).
        map.on("click", (e) => {
          if (!map.queryRenderedFeatures(e.point, { layers: ["planes"] }).length) {
            deselectPlane();
          }
        });
        map.on("mouseenter", "planes", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "planes", () => {
          map.getCanvas().style.cursor = "";
        });

        // Poll the backend and update plane positions in place (no reload).
        pollId = setInterval(async () => {
          try {
            const next = await loadPlanes();
            const src = map.getSource("planes") as GeoJSONSource | undefined;
            src?.setData(planesToGeoJSON(next));
            setPlaneList(next);
            planesRef.current = next;
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
      map.remove();
      mapRef.current = null;
    };
    // Map is created once; select/deselect read only stable refs + setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modes: { id: Basemap; label: string }[] = [
    { id: "streets", label: "Streets" },
    { id: "dark", label: "Dark" },
    { id: "satellite", label: "Satellite" },
  ];

  // Label/value rows for the detail sidebar (nulls filtered out at render).
  const ft = (m: number | null) =>
    typeof m === "number" ? `${Math.round(m * 3.281).toLocaleString()} ft` : null;
  const detailRows: [string, string | null][] = selected
    ? [
        ["Status", selected.flight_status],
        ["Airline", selected.owner ?? selected.operator_callsign],
        ["Aircraft", selected.model],
        ["Type", selected.typecode],
        ["Maker", selected.manufacturername],
        ["Registration", selected.registration],
        ["From", selected.origin_iata],
        ["To", selected.destination_iata],
        ["Dep (sched)", fmtSched(selected.scheduled_departure)],
        ["Arr (sched)", fmtSched(selected.scheduled_arrival)],
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
        ["Country", selected.origin_country || null],
        ["Updated", timeAgo(selected.last_time_position) || null],
        ["ICAO24", selected.icao24],
        ["Trip", selected.trip_id],
      ]
    : [];

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
      <div className="absolute left-4 top-14 z-10 flex overflow-hidden rounded-md border border-white/10 bg-black/50 text-xs font-medium backdrop-blur">
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
      </div>

      {/* Floating list of planes currently on the map. */}
      <div className="absolute right-4 top-4 z-10 flex max-h-[calc(100dvh-2rem)] w-64 flex-col overflow-hidden rounded-md border border-white/10 bg-black/55 text-xs backdrop-blur">
        <button
          type="button"
          onClick={() => setListOpen((v) => !v)}
          className="flex items-center justify-between px-3 py-2 font-semibold text-white/90 hover:bg-white/5"
        >
          <span>Flights ({planeList.length})</span>
          <span className="text-white/50">{listOpen ? "▾" : "▸"}</span>
        </button>
        {listOpen && (
          <ul className="divide-y divide-white/5 overflow-y-auto">
            {[...planeList]
              .sort((a, b) => {
                if (a.on_ground !== b.on_ground) return a.on_ground ? 1 : -1;
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
        )}
      </div>

      {/* Detail sidebar for the selected plane. */}
      {selected && (
        <div className="absolute left-4 top-28 z-10 flex max-h-[calc(100dvh-8rem)] w-72 flex-col overflow-hidden rounded-md border border-white/10 bg-black/70 text-xs text-white/85 backdrop-blur">
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
            <button
              type="button"
              onClick={deselectPlane}
              aria-label="Close"
              className="shrink-0 rounded px-1.5 text-base leading-none text-white/60 hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>
          <dl className="divide-y divide-white/5 overflow-y-auto">
            {detailRows
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
