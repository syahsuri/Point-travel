import type { TripHistory } from "./types";

/**
 * Fetch one trip's actual flown track via the `/api/history/[tripId]` proxy
 * (the backend has no CORS header, so the browser can't call it directly).
 *
 * Client-safe (plain fetch, no server-only imports) so it can run inside the
 * `'use client'` map component.
 */
export async function loadHistory(tripId: string): Promise<TripHistory> {
  const res = await fetch(`/api/history/${encodeURIComponent(tripId)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`loadHistory: failed for ${tripId} (${res.status})`);
  }
  return (await res.json()) as TripHistory;
}
