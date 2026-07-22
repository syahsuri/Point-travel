"use client";

import { useEffect, useState } from "react";
import type { RefObject } from "react";
import type maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import { loadSchedule } from "@/lib/schedule";
import type { Airport, ScheduleEntry } from "@/lib/types";

type UseAirportSelectionArgs = {
  mapRef: RefObject<maplibregl.Map | null>;
  onSelect: () => void; // called to close any open plane selection first
};

/**
 * Owns everything related to selecting an airport: which one is selected,
 * which arrivals/departures tab is active, and the fetched schedule data.
 * Also mirrors the selected airport onto the map (icon swap + highlight)
 * and fetches the schedule board whenever the airport or tab changes.
 */
export function useAirportSelection({ mapRef, onSelect }: UseAirportSelectionArgs) {
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
  const [airportBoardTab, setAirportBoardTab] = useState<"arrival" | "departure">(
    "departure"
  );
  const [scheduleData, setScheduleData] = useState<{
    key: string;
    entries: ScheduleEntry[];
  } | null>(null);

  const scheduleKey = selectedAirport?.iata_code
    ? `${selectedAirport.iata_code}-${airportBoardTab === "arrival" ? "A" : "D"}`
    : null;
  const schedule =
    scheduleData && scheduleData.key === scheduleKey ? scheduleData.entries : [];
  const scheduleLoading =
    scheduleKey !== null && (!scheduleData || scheduleData.key !== scheduleKey);

  // Select an airport (from the map or the sidebar list): close any plane
  // selection first, set the airport, reset to the departures tab, fly to it.
  function selectAirport(a: Airport) {
    onSelect();
    setSelectedAirport(a);
    setAirportBoardTab("departure");
    const map = mapRef.current;
    if (map) {
      map.flyTo({
        center: [a.longitude_deg, a.latitude_deg],
        zoom: Math.max(map.getZoom(), 8),
      });
    }
  }

  function deselectAirport() {
    setSelectedAirport(null);
  }

  // Highlight the selected airport on the map — swap its icon and hide the
  // base marker underneath, mirroring the selected-plane icon swap.
  useEffect(() => {
    const map = mapRef.current;
    const src = map?.getSource("selected-airport") as GeoJSONSource | undefined;
    if (!map || !src) return;

    if (map.getLayer("airport-dot")) {
      map.setFilter(
        "airport-dot",
        selectedAirport
          ? ["!=", ["get", "icao"], selectedAirport.icao_code ?? ""]
          : null
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
                coordinates: [
                  selectedAirport.longitude_deg,
                  selectedAirport.latitude_deg,
                ],
              },
              properties: {},
            },
          ]
        : [],
    });
  }, [selectedAirport, mapRef]);

  // Fetch arrivals/departures for the selected airport whenever the airport
  // or the arrival/departure tab changes.
  useEffect(() => {
    const iata = selectedAirport?.iata_code;
    if (!iata) return; // nothing to fetch; `schedule` derives to [] on its own

    let cancelled = false;
    const type = airportBoardTab === "arrival" ? "A" : "D";
    const key = `${iata}-${type}`;

    loadSchedule(iata, type, 50)
      .then((entries) => {
        if (!cancelled) setScheduleData({ key, entries });
      })
      .catch((err) => {
        console.error("[schedule]", err);
        if (!cancelled) setScheduleData({ key, entries: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAirport, airportBoardTab]);

  return {
    selectedAirport,
    setSelectedAirport,
    airportBoardTab,
    setAirportBoardTab,
    schedule,
    scheduleLoading,
    selectAirport,
    deselectAirport,
  };
}