/**
 * Plane state shape — mirrors the OpenSky Network "state vector" fields.
 * https://openskynetwork.github.io/opensky-api/rest.html#response
 *
 * The real backend (built separately) and OpenSky both return these fields,
 * so keeping this shape now means the later swap from static JSON to a live
 * fetch is a one-line change in `lib/planes.ts` — no UI rewrite.
 *
 * Units follow OpenSky: lon/lat in degrees, altitude in meters, velocity in
 * m/s, true_track in decimal degrees clockwise from north (0 = north).
 */
export interface StateVector {
  /** Unique ICAO 24-bit address of the transponder, hex string. Stable id. */
  icao24: string;
  /** Callsign (flight number), may be null when not broadcast. */
  callsign: string | null;
  /** Origin country name. */
  origin_country: string;
  /** WGS-84 longitude in degrees. */
  longitude: number;
  /** WGS-84 latitude in degrees. */
  latitude: number;
  /** Barometric altitude in meters. Null if unavailable. */
  baro_altitude: number | null;
  /** Geometric (GPS) altitude in meters. Null if unavailable. */
  geo_altitude: number | null;
  /** True on the ground (no altitude). */
  on_ground: boolean;
  /** Speed over ground in m/s. */
  velocity: number | null;
  /** Heading: decimal degrees clockwise from north (0 = north). */
  true_track: number | null;

  // --- Enriched fields from the gukgukcraft backend (all optional; may be
  // null when the backend can't resolve them). Not part of raw OpenSky. ---

  /** Stable per-leg id, e.g. "71c210_KAL437_2026-07-08_1783445036". */
  trip_id: string | null;
  /** ICAO airline prefix, e.g. "KAL". */
  icao_prefix: string | null;
  /** IATA airline prefix, e.g. "KE". */
  iata_prefix: string | null;
  /** ISO-8601 local timestamp of the last position report. */
  last_time_position: string | null;
  /** Tail number, e.g. "HL8210". */
  registration: string | null;
  /** Airframe maker, e.g. "Boeing". */
  manufacturername: string | null;
  /** Full model, e.g. "Boeing 777-3B5(ER)". */
  model: string | null;
  /** ICAO type designator, e.g. "B77W". */
  typecode: string | null;
  /** Radio callsign of the operator, e.g. "KOREANAIR". */
  operator_callsign: string | null;
  /** Aircraft owner / airline, e.g. "Korean Air". */
  owner: string | null;
  /** Origin airport IATA code, e.g. "ICN". */
  origin_iata: string | null;
  /** Destination airport IATA code, e.g. "CGK". */
  destination_iata: string | null;
  /** Scheduled departure, ISO-8601. */
  scheduled_departure: string | null;
  /** Scheduled arrival, ISO-8601. */
  scheduled_arrival: string | null;
  /** Human flight phase, e.g. "Descending", "Cruising". */
  flight_status: string | null;
}

/** A batch of plane states, matching OpenSky's `/states/all` envelope. */
export interface StatesResponse {
  /** Unix seconds the batch was sampled. */
  time: number;
  states: StateVector[];
}

/**
 * A single completed/in-progress trip's actual flown track, from the backend's
 * `/historical/{trip_id}` endpoint. Normalized by `/api/history/[tripId]`.
 */
export interface TripHistory {
  trip_id: string;
  icao24: string;
  callsign: string | null;
  /** ISO-8601 first position time. */
  trip_start_time: string | null;
  /** ISO-8601 last position time. */
  trip_end_time: string | null;
  /** Peak speed over ground, m/s. */
  max_velocity: number | null;
  /** Peak altitude, meters. */
  max_altitude: number | null;
  /** True once the trip is closed out. */
  is_completed: boolean;
  /** Flown path as [lon, lat] pairs, in chronological order. */
  path: [number, number][];
}
