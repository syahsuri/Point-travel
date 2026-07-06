"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
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

// Plane icon points NORTH (up) at rest, so MapLibre's icon-rotate (degrees
// clockwise from north) lines up directly with OpenSky's `true_track`.
const PLANE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28"><path fill="#e8f0ff" stroke="#0b1622" stroke-width="0.6" stroke-linejoin="round" d="M12 2 L13.4 12 L22 16 L22 17.6 L13.4 15 L13.4 20 L16 22 L16 23 L12 21.6 L8 23 L8 22 L10.6 20 L10.6 15 L2 17.6 L2 16 L10.6 12 Z"/></svg>`;

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
      },
    })),
  };
}

function popupHTML(props: Record<string, unknown>): string {
  const callsign = String(props.callsign ?? "N/A");
  const alt = props.baro_altitude;
  const vel = props.velocity;
  const altFt =
    typeof alt === "number" ? `${Math.round(alt * 3.281).toLocaleString()} ft` : "—";
  const spdKts =
    typeof vel === "number" ? `${Math.round(vel * 1.944)} kts` : "—";
  const status = props.on_ground ? "on ground" : "airborne";
  return `
    <div style="font-weight:600;margin-bottom:4px">${callsign}</div>
    <div style="color:#8fb3cc">alt ${altFt} · spd ${spdKts}</div>
    <div style="color:#8fb3cc">${status} · ${String(props.icao24 ?? "")}</div>
  `;
}

export default function FlightMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [basemap, setBasemapState] = useState<Basemap>("dark");

  function selectBasemap(mode: Basemap) {
    setBasemapState(mode);
    const map = mapRef.current;
    if (map) setBasemap(map, mode);
  }

  useEffect(() => {
    if (!containerRef.current) return;

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

      // Load the plane icon (SVG -> raster) before adding the symbol layer.
      const img = new Image(28, 28);
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
            "icon-size": 0.9,
            "icon-rotate": ["get", "track"],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
          },
        });

        // Click a plane -> popup with callsign + altitude/speed.
        map.on("click", "planes", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const geom = f.geometry as GeoJSON.Point;
          new maplibregl.Popup({ offset: 14 })
            .setLngLat([geom.coordinates[0], geom.coordinates[1]])
            .setHTML(popupHTML(f.properties ?? {}))
            .addTo(map);
        });
        map.on("mouseenter", "planes", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "planes", () => {
          map.getCanvas().style.cursor = "";
        });
      };
      img.src = `data:image/svg+xml;base64,${btoa(PLANE_SVG)}`;
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const modes: { id: Basemap; label: string }[] = [
    { id: "dark", label: "Dark" },
    { id: "satellite", label: "Satellite" },
    { id: "streets", label: "Streets" },
  ];

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
    </div>
  );
}
