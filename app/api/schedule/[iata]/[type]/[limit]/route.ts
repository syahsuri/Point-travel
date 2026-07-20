import type { NextRequest } from "next/server";
import { fetchRetry } from "@/lib/fetchRetry";
import type { ScheduleEntry } from "@/lib/types";

/**
 * Server-side proxy for arrivals/departures at a given airport.
 *
 * The backend (https://flights.gukgukcraft.id/schedule/{iata}/{A|D}/{limit})
 * sits behind Cloudflare with no CORS header, so the browser can't fetch it
 * directly. This route fetches it server-side and returns a normalized
 * ScheduleEntry[] array. Runs at request time (dynamic).
 */
export const dynamic = "force-dynamic";

const BACKEND_ORIGIN = (
  process.env.FLIGHTS_API_URL ?? "https://flights.gukgukcraft.id/flights"
).replace(/\/flights\/?$/, "");

const AUTH_TOKEN = process.env.FLIGHTS_AUTH_TOKEN ?? "";

type RawSchedule = Partial<ScheduleEntry> & Record<string, unknown>;

const str = (v: unknown): string | null =>
  typeof v === "string" && v !== "" ? v : null;
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function toScheduleEntry(r: RawSchedule): ScheduleEntry {
  return {
    board_type: r.board_type === "A" || r.board_type === "D" ? r.board_type : null,
    board_airport_iata: str(r.board_airport_iata),
    board_airport_name: str(r.board_airport_name),
    country_id: str(r.country_id),
    flight_no: str(r.flight_no),
    airline_name: str(r.airline_name),
    airline_iata: str(r.airline_iata),
    sched_time: str(r.sched_time),
    route_airport_iata: str(r.route_airport_iata),
    sched_dep: str(r.sched_dep),
    sched_arr: str(r.sched_arr),
    icao24: str(r.icao24),
    callsign: str(r.callsign),
    registration: str(r.registration),
    model: str(r.model),
    typecode: str(r.typecode),
    origin_iata: str(r.origin_iata),
    destination_iata: str(r.destination_iata),
    flight_status: str(r.flight_status),
    last_time_position: str(r.last_time_position),
    latitude: num(r.latitude),
    longitude: num(r.longitude),
    baro_altitude: num(r.baro_altitude),
    velocity: num(r.velocity),
    true_track: num(r.true_track),
    is_completed: r.is_completed === true,
    board_status: str(r.board_status),
    schedule_date: str(r.schedule_date),
  };
}

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/schedule/[iata]/[type]/[limit]">
) {
  const { iata, type, limit } = await ctx.params;

  // Basic validation — backend expects A or D, and a numeric limit.
  const boardType = type.toUpperCase();
  if (boardType !== "A" && boardType !== "D") {
    return Response.json(
      { error: "type must be 'A' or 'D'" },
      { status: 400 }
    );
  }
  const limitNum = Number(limit);
  if (!Number.isFinite(limitNum) || limitNum <= 0) {
    return Response.json({ error: "limit must be a positive number" }, { status: 400 });
  }

  try {
    const res = await fetchRetry(
      `${BACKEND_ORIGIN}/schedule/${encodeURIComponent(iata)}/${boardType}/${limitNum}`,
      {
        cache: "no-store",
        headers: AUTH_TOKEN ? { auth_token: AUTH_TOKEN } : undefined,
      }
    );
    if (!res.ok) throw new Error(`backend ${res.status}`);

    const raw = (await res.json()) as unknown;
    const list: RawSchedule[] = Array.isArray(raw) ? raw : [];
    const entries = list.map(toScheduleEntry);

    return Response.json(entries, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("[/api/schedule]", err);
    // Empty (200) so the client degrades gracefully.
    return Response.json([]);
  }
}