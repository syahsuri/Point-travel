import type { StatesResponse } from "./types";

/**
 * The single seam between the UI and the data source.
 *
 * Points at the `/api/planes` route handler, which proxies the live backend
 * server-side (the backend has no CORS header, so the browser can't call it
 * directly). The `FlightMap` component consumes `StateVector[]` and does not
 * care where it came from — polling just re-calls this.
 *
 * Kept client-safe (plain fetch, no server-only imports) so it can run inside
 * the `'use client'` map component.
 *
 * Response body is base64-encoded server-side purely to keep the raw JSON
 * out of a casual glance at the Network tab's Response preview. This is NOT
 * a security boundary — the decode logic is right here in client-shipped
 * JS, readable by anyone via DevTools > Sources, and any online base64
 * decoder reverses it instantly. Real access control lives in middleware.ts
 * (signed cookie + rate limit), not here.
 */
const PLANES_SOURCE = "/api/planes";

export async function loadPlanes(): Promise<StatesResponse> {
  const res = await fetch(PLANES_SOURCE, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`loadPlanes: failed to fetch ${PLANES_SOURCE} (${res.status})`);
  }
  const { data } = (await res.json()) as { data: string };
  return JSON.parse(atob(data)) as StatesResponse;
}