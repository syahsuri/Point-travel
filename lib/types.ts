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
}

/** A batch of plane states, matching OpenSky's `/states/all` envelope. */
export interface StatesResponse {
  /** Unix seconds the batch was sampled. */
  time: number;
  states: StateVector[];
}
