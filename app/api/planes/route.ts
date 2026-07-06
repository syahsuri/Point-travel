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

    const states = list
      .map(toStateVector)
      .filter((s): s is StateVector => s !== null);

    // Data age: newest last_contact if present, else now.
    const time = list.reduce((max, r) => {
      const t = typeof r.last_contact === "number" ? r.last_contact : 0;
      return t > max ? t : max;
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
