import type { StateVector } from "@/lib/types";
import { fetchRetry } from "@/lib/fetchRetry";

export const dynamic = "force-dynamic";

const BACKEND_URL =
  process.env.FLIGHTS_API_URL ?? "https://flights.gukgukcraft.id/flights";

const AUTH_TOKEN = process.env.FLIGHTS_AUTH_TOKEN ?? "";

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
  const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
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
    signal_age: num(r.signal_age),
    true_track: num(r.true_track),
    category: num(r.category),
    plane_type: r.plane_type ?? null,
    squawk: r.squawk ?? null,
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

// The backend rate-limits /flights to 30/min per IP and every browser reaches
// it through this server's IP, so one snapshot is shared by all users and
// concurrent requests wait on the same backend call.
const CACHE_TTL_MS = 10_000;
let cached: { at: number; payload: string } | null = null;
let inflight: Promise<string> | null = null;

function refresh(): Promise<string> {
  inflight ??= fetchPayload()
    .then((payload) => {
      cached = { at: Date.now(), payload };
      return payload;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export async function GET() {
  try {
    const payload =
      cached && Date.now() - cached.at < CACHE_TTL_MS
        ? cached.payload
        : await refresh();
    return Response.json(
      { data: payload },
      { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (err) {
    console.error("[/api/planes]", err);
    // Non-2xx makes the client keep its current planes; a 200 with an empty
    // list would blank the map for every user on one backend hiccup.
    return Response.json({ error: "backend unavailable" }, { status: 502 });
  }
}

async function fetchPayload(): Promise<string> {
  const res = await fetchRetry(BACKEND_URL, {
    cache: "no-store",
    headers: AUTH_TOKEN ? { auth_token: AUTH_TOKEN } : undefined,
  });
  if (!res.ok) throw new Error(`backend ${res.status}`);

  const raw = (await res.json()) as unknown;
  const list: RawState[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { states?: unknown }).states)
      ? (raw as { states: RawState[] }).states
      : [];

  const parsed = list
    .map(toStateVector)
    .filter((s): s is StateVector => s !== null);

  const reportSecs = (iso: string | null): number => {
    if (!iso) return 0;
    const withTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
    const ms = Date.parse(withTz);
    return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000);
  };

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

  const time = list.reduce((max, r) => {
    const t =
      typeof r.last_time_position === "string"
        ? reportSecs(r.last_time_position)
        : typeof r.last_contact === "number"
          ? r.last_contact
          : 0;
    return Math.max(max, t);
  }, Math.floor(Date.now() / 1000));

  return Buffer.from(JSON.stringify({ time, states })).toString("base64");
}
