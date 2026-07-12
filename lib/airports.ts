import type { Airport } from "./types";

/**
 * Fetches all airports from the `/api/airports` proxy route.
 *
 * The proxy calls the real backend server-side to avoid CORS. This function
 * is kept client-safe (plain fetch, no server-only imports) so it can run
 * inside the `'use client'` map component.
 */
const AIRPORTS_SOURCE = "/api/airports";

export async function loadAirports(): Promise<Airport[]> {
  const res = await fetch(AIRPORTS_SOURCE, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `loadAirports: failed to fetch ${AIRPORTS_SOURCE} (${res.status})`
    );
  }
  return (await res.json()) as Airport[];
}
