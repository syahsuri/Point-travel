"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import { loadPlanes } from "@/lib/planes";
import type { StateVector } from "@/lib/types";

/**
 * Full-screen FlightRadar24-style map.
 *
 * MapLibre touches the DOM and WebGL, so this is a Client Component and the
 * map is created inside useEffect (never during render / on the server).
 *
 * Basemap = local Natural Earth GeoJSON rendered as dark polygons. No tile
 * server, no API key, no rate limits. Planes are drawn as a single WebGL
 * symbol layer (scales to thousands) with each icon rotated by its heading.
 */

// Indonesia bounding box [west, south, east, north] — keeps the view (and the
// data we care about) scoped small.
const INDONESIA_BOUNDS: [number, number, number, number] = [94, -11, 141, 7];

// Plane icon points NORTH (up) at rest, so MapLibre's icon-rotate (degrees
// clockwise from north) lines up directly with OpenSky's `true_track`.
const PLANE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28"><path fill="#e8f0ff" stroke="#0b1622" stroke-width="0.6" stroke-linejoin="round" d="M12 2 L13.4 12 L22 16 L22 17.6 L13.4 15 L13.4 20 L16 22 L16 23 L12 21.6 L8 23 L8 22 L10.6 20 L10.6 15 L2 17.6 L2 16 L10.6 12 Z"/></svg>`;

// Minimal style with NO external tiles: dark sea background + local land GeoJSON.
const BASE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    world: {
      type: "geojson",
      data: "/data/world-110m.geojson",
    },
  },
  layers: [
    { id: "sea", type: "background", paint: { "background-color": "#0b1622" } },
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

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new maplibregl.AttributionControl({
        customAttribution: "Basemap © Natural Earth (public domain)",
      })
    );

    map.on("load", async () => {
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

  return <div ref={containerRef} className="h-screen w-screen" />;
}
