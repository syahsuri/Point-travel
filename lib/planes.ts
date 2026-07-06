import type { StateVector, StatesResponse } from "./types";

/**
 * The single seam between the UI and the data source.
 *
 * Today it loads a static JSON file bundled in /public. When the real backend
 * is ready, swap the fetch URL (or add polling) here — the `FlightMap`
 * component consumes `StateVector[]` and does not care where it came from.
 *
 * Kept client-safe (plain fetch, no server-only imports) so it can run inside
 * the `'use client'` map component.
 */
const STATIC_SOURCE = "/data/planes-indonesia.json";

export async function loadPlanes(): Promise<StateVector[]> {
  const res = await fetch(STATIC_SOURCE, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`loadPlanes: failed to fetch ${STATIC_SOURCE} (${res.status})`);
  }
  const data = (await res.json()) as StatesResponse;
  return data.states;
}
