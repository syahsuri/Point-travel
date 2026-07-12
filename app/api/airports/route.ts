import { fetchRetry } from "@/lib/fetchRetry";
import type { Airport } from "@/lib/types";

/**
 * Server-side proxy for the airports list.
 *
 * The backend (https://flights.gukgukcraft.id/airports) sits behind Cloudflare
 * with no CORS header, so the browser can't fetch it directly. This route
 * fetches it server-side and returns a normalized Airport[] array.
 * Runs at request time (dynamic); edge-cached for a longer period since airport
 * data is static.
 */
export const dynamic = "force-dynamic";

const BACKEND_ORIGIN = (
  process.env.FLIGHTS_API_URL ?? "https://flights.gukgukcraft.id/flights"
).replace(/\/flights\/?$/, "");

const AUTH_TOKEN = process.env.FLIGHTS_AUTH_TOKEN ?? "";

type RawAirport = Partial<Airport> & Record<string, unknown>;

const str = (v: unknown): string | null =>
  typeof v === "string" && v !== "" ? v : null;
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function toAirport(r: RawAirport): Airport | null {
  const lat = num(r.latitude_deg);
  const lon = num(r.longitude_deg);
  // Skip entries without valid coordinates — they can't be placed on the map.
  if (lat === null || lon === null) return null;

  return {
    iata_code: str(r.iata_code),
    icao_code: str(r.icao_code),
    name: str(r.name) ?? "Unknown Airport",
    latitude_deg: lat,
    longitude_deg: lon,
    iso_country: str(r.iso_country) ?? "",
    type: str(r.type) ?? "airport",
  };
}

export async function GET() {
  try {
    const res = await fetchRetry(`${BACKEND_ORIGIN}/airports`, {
      cache: "no-store",
      headers: AUTH_TOKEN ? { auth_token: AUTH_TOKEN } : undefined,
    });
    if (!res.ok) throw new Error(`backend ${res.status}`);

    const raw = (await res.json()) as unknown;
    const list: RawAirport[] = Array.isArray(raw) ? raw : [];

    const airports = list
      .map(toAirport)
      .filter((a): a is Airport => a !== null);

    return Response.json(airports, {
      headers: {
        // Airport data is static — cache aggressively.
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("[/api/airports]", err);
    // Return empty array (200) so the client degrades gracefully.
    return Response.json([]);
  }
}
