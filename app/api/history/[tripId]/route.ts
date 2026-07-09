import type { NextRequest } from "next/server";
import type { TripHistory } from "@/lib/types";
import { fetchRetry } from "@/lib/fetchRetry";

/**
 * Server-side proxy for a single trip's historical track.
 *
 * The backend (https://flights.gukgukcraft.id/historical/{trip_id}) sits behind
 * Cloudflare with no CORS header, so the browser can't fetch it directly. This
 * route fetches it server-side and returns a normalized `TripHistory` the map
 * consumes. Runs at request time (dynamic).
 */
export const dynamic = "force-dynamic";

const BACKEND_ORIGIN = (
  process.env.FLIGHTS_API_URL ?? "https://flights.gukgukcraft.id/flights"
).replace(/\/flights\/?$/, "");

const AUTH_TOKEN = process.env.FLIGHTS_AUTH_TOKEN ?? "";

type RawPoint = { lat?: unknown; lon?: unknown };
type RawTrip = Partial<TripHistory> &
  Record<string, unknown> & { path_points?: RawPoint[] };

const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
const str = (v: unknown): string | null =>
  typeof v === "string" && v !== "" ? v : null;

function normalize(tripId: string, r: RawTrip): TripHistory {
  const path: [number, number][] = [];
  for (const p of r.path_points ?? []) {
    const lon = p.lon;
    const lat = p.lat;
    if (typeof lon !== "number" || typeof lat !== "number") continue;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    // Collapse consecutive duplicate points (the backend repeats some).
    const last = path[path.length - 1];
    if (last && last[0] === lon && last[1] === lat) continue;
    path.push([lon, lat]);
  }
  return {
    trip_id: str(r.trip_id) ?? tripId,
    icao24: str(r.icao24) ?? "",
    callsign: str(r.callsign),
    trip_start_time: str(r.trip_start_time),
    trip_end_time: str(r.trip_end_time),
    max_velocity: num(r.max_velocity),
    max_altitude: num(r.max_altitude),
    is_completed: r.is_completed === true,
    path,
  };
}

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/history/[tripId]">
) {
  const { tripId } = await ctx.params;
  try {
    const res = await fetchRetry(
      `${BACKEND_ORIGIN}/historical/${encodeURIComponent(tripId)}`,
      {
        cache: "no-store",
        headers: AUTH_TOKEN ? { auth_token: AUTH_TOKEN } : undefined,
      }
    );
    if (!res.ok) throw new Error(`backend ${res.status}`);

    const raw = (await res.json()) as unknown;
    // Backend returns a one-element array; tolerate a bare object too.
    const trip: RawTrip = Array.isArray(raw)
      ? (raw[0] as RawTrip)
      : (raw as RawTrip);

    return Response.json(normalize(tripId, trip ?? {}), {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (err) {
    console.error("[/api/history]", err);
    // Empty (200) so the client keeps its great-circle placeholder.
    const empty: TripHistory = {
      trip_id: tripId,
      icao24: "",
      callsign: null,
      trip_start_time: null,
      trip_end_time: null,
      max_velocity: null,
      max_altitude: null,
      is_completed: false,
      path: [],
    };
    return Response.json(empty);
  }
}
