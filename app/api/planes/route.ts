import type { StateVector } from "@/lib/types";

/**
 * Server-side proxy for the flight backend.
 *
 * The backend (https://flights.gukgukcraft.id/flights) sends no CORS header, so
 * the browser can't fetch it directly — this route fetches it server-side and
 * returns a normalized { time, states } envelope the map consumes. Runs at
 * request time (network fetch = dynamic); edge-cached briefly via Cache-Control.
 */
export const dynamic = "force-dynamic";

const BACKEND_URL =
  process.env.FLIGHTS_API_URL ?? "https://flights.gukgukcraft.id/flights";

// The backend returns a bare array; tolerate a { states } envelope too.
type RawState = Partial<StateVector> & Record<string, unknown>;

function toStateVector(r: RawState): StateVector | null {
  const { icao24, longitude, latitude } = r;
  if (
    typeof icao24 !== "string" ||
    typeof longitude !== "number" ||
    typeof latitude !== "number"
  ) {
    return null; // skip empty {} / malformed entries
  }
  const num = (v: unknown): number | null =>
    typeof v === "number" ? v : null;
  const str = (v: unknown): string | null =>
    typeof v === "string" && v !== "" ? v : null;
  return {
    icao24,
    callsign: typeof r.callsign === "string" ? r.callsign.trim() : null,
    origin_country:
      typeof r.origin_country === "string" ? r.origin_country : "",
    longitude,
    latitude,
    baro_altitude: num(r.baro_altitude),
    geo_altitude: num(r.geo_altitude),
    on_ground: r.on_ground === true,
    velocity: num(r.velocity),
    true_track: num(r.true_track),
    // Enriched backend fields.
    trip_id: str(r.trip_id),
    icao_prefix: str(r.icao_prefix),
    iata_prefix: str(r.iata_prefix),
    last_time_position: str(r.last_time_position),
    registration: str(r.registration),
    manufacturername: str(r.manufacturername),
    model: str(r.model),
    typecode: str(r.typecode),
    operator_callsign: str(r.operator_callsign),
    owner: str(r.owner),
    origin_iata: str(r.origin_iata),
    destination_iata: str(r.destination_iata),
    scheduled_departure: str(r.scheduled_departure),
    scheduled_arrival: str(r.scheduled_arrival),
    flight_status: str(r.flight_status),
  };
}

export async function GET() {
  try {
    const res = await fetch(BACKEND_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`backend ${res.status}`);

    const raw = (await res.json()) as unknown;
    const list: RawState[] = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { states?: unknown }).states)
        ? ((raw as { states: RawState[] }).states)
        : [];

    const parsed = list
      .map(toStateVector)
      .filter((s): s is StateVector => s !== null);

    // Report time in unix seconds from an ISO string. Backend sends naive ISO
    // (no tz) meaning UTC — append Z so Date.parse doesn't read it as
    // server-local. Leaves an already-offset string alone. Null/invalid -> 0.
    const reportSecs = (iso: string | null): number => {
      if (!iso) return 0;
      const withTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
      const ms = Date.parse(withTz);
      return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000);
    };

    // The backend can send several trip rows per aircraft in one response.
    // Collapse to one entry per icao24, keeping the freshest position — this
    // keeps the client's `key={icao24}` unique and shows one marker per plane.
    const byIcao = new Map<string, StateVector>();
    for (const s of parsed) {
      const prev = byIcao.get(s.icao24);
      if (
        !prev ||
        reportSecs(s.last_time_position) >= reportSecs(prev.last_time_position)
      ) {
        byIcao.set(s.icao24, s);
      }
    }
    const states = [...byIcao.values()];

    // Data age: newest report time across the raw rows. Tolerate the old
    // numeric `last_contact` too. Falls back to now.
    const time = list.reduce((max, r) => {
      const t =
        typeof r.last_time_position === "string"
          ? reportSecs(r.last_time_position)
          : typeof r.last_contact === "number"
            ? r.last_contact
            : 0;
      return Math.max(max, t);
    }, Math.floor(Date.now() / 1000));

    return Response.json(
      { time, states },
      { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" } }
    );
  } catch (err) {
    console.error("[/api/planes]", err);
    // Return empty (200) so the client keeps its last-known planes.
    return Response.json({ time: Math.floor(Date.now() / 1000), states: [] });
  }
}
