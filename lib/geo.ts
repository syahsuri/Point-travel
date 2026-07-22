// Pure geometry/math helpers for the flight map. 

/**
 * Shortest signed angular difference a-b, normalized to [-180, 180] degrees.
 */
export function angDelta(a: number, b: number): number {
    return ((((a - b) % 360) + 540) % 360) - 180;
  }
  
  /**
   * Great-circle (slerp) between two [lon,lat] points -> line coordinates.
   * Unwraps longitude so a path near the antimeridian doesn't streak across the
   * whole map. Used to draw a plane's path from its origin airport to current pos.
   */
  export function greatCircle(
    a: [number, number],
    b: [number, number],
    steps = 128
  ): [number, number][] {
    const R = Math.PI / 180;
    const D = 180 / Math.PI;
    const lon1 = a[0] * R,
      lat1 = a[1] * R,
      lon2 = b[0] * R,
      lat2 = b[1] * R;
    const d =
      2 *
      Math.asin(
        Math.sqrt(
          Math.sin((lat2 - lat1) / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
        )
      );
    if (d === 0) return [a, b];
    const pts: [number, number][] = [];
    let prevLon: number | null = null;
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const A = Math.sin((1 - f) * d) / Math.sin(d);
      const B = Math.sin(f * d) / Math.sin(d);
      const x =
        A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
      const y =
        A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
      const z = A * Math.sin(lat1) + B * Math.sin(lat2);
      const lat = Math.atan2(z, Math.hypot(x, y)) * D;
      let lon = Math.atan2(y, x) * D;
      if (prevLon !== null) {
        while (lon - prevLon > 180) lon -= 360;
        while (lon - prevLon < -180) lon += 360;
      }
      prevLon = lon;
      pts.push([lon, lat]);
    }
    return pts;
  }
  
  /**
   * Chaikin's corner-cutting algorithm: rounds sharp turns in a path into
   * smooth curves. Endpoints are preserved exactly (not cut).
   */
  export function smoothPath(
    path: [number, number][],
    iterations = 2
  ): [number, number][] {
    if (path.length < 3) return path;
    let pts = path;
    for (let iter = 0; iter < iterations; iter++) {
      const next: [number, number][] = [pts[0]]; // keep exact start
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[i + 1];
        next.push([x0 + (x1 - x0) * 0.25, y0 + (y1 - y0) * 0.25]);
        next.push([x0 + (x1 - x0) * 0.75, y0 + (y1 - y0) * 0.75]);
      }
      next.push(pts[pts.length - 1]); // keep exact end
      pts = next;
    }
    return pts;
  }
  
  /**
   * Great-circle distance between two [lon,lat] points, in meters (haversine).
   */
  export function haversineMeters(a: [number, number], b: [number, number]): number {
    const R = 6371000;
    const r = Math.PI / 180;
    const dLat = (b[1] - a[1]) * r;
    const dLon = (b[0] - a[0]) * r;
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  
  /**
   * Point at fraction `t` (0..1) along a polyline, measured by great-circle
   * segment length. Used by the flight-replay scrubber. Returns null if path empty.
   */
  export function pointAlong(
    path: [number, number][],
    t: number
  ): [number, number] | null {
    if (path.length === 0) return null;
    if (path.length === 1) return path[0];
    const segs = path.slice(1).map((p, i) => haversineMeters(path[i], p));
    const total = segs.reduce((a, b) => a + b, 0);
    if (total === 0) return path[0];
    let target = Math.max(0, Math.min(1, t)) * total;
    for (let i = 0; i < segs.length; i++) {
      if (target <= segs[i] || i === segs.length - 1) {
        const f = segs[i] === 0 ? 0 : target / segs[i];
        const a = path[i];
        const b = path[i + 1];
        return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      }
      target -= segs[i];
    }
    return path[path.length - 1];
  }
  
  /**
   * Project a point forward along a heading (dead reckoning) on a sphere.
   * Used to animate airborne planes between polls. Returns the input unchanged
   * when velocity/heading is unavailable. lon/lat in degrees, v in m/s.
   */
  export function deadReckon(
    lon: number,
    lat: number,
    velocityMs: number | null,
    trackDeg: number | null,
    dtSec: number
  ): [number, number] {
    if (
      typeof velocityMs !== "number" ||
      typeof trackDeg !== "number" ||
      velocityMs <= 0
    ) {
      return [lon, lat];
    }
    const R = 6371000; // earth radius, meters
    const d = (velocityMs * dtSec) / R; // angular distance
    const th = (trackDeg * Math.PI) / 180;
    const la1 = (lat * Math.PI) / 180;
    const lo1 = (lon * Math.PI) / 180;
    const la2 = Math.asin(
      Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(th)
    );
    const lo2 =
      lo1 +
      Math.atan2(
        Math.sin(th) * Math.sin(d) * Math.cos(la1),
        Math.cos(d) - Math.sin(la1) * Math.sin(la2)
      );
    return [(lo2 * 180) / Math.PI, (la2 * 180) / Math.PI];
  }
  
  /**
   * Forward-projected path from a live position over `horizonSec` seconds.
   * Integrates in fine `stepSec` steps, rotating the heading by
   * `turnRateDegPerSec` each step — so a turning plane's forecast bends into a
   * circular arc instead of a straight line. Empty when velocity/heading
   * unknown. Drives the yellow "next 2 min" prediction line of the selected
   * plane, and the near-miss conflict radar.
   */
  export function predictPath(
    lon: number,
    lat: number,
    velocityMs: number | null,
    trackDeg: number | null,
    turnRateDegPerSec = 0,
    horizonSec = 120,
    stepSec = 5
  ): [number, number][] {
    if (
      typeof velocityMs !== "number" ||
      typeof trackDeg !== "number" ||
      velocityMs <= 0
    ) {
      return [];
    }
    const pts: [number, number][] = [];
    let pos: [number, number] = [lon, lat];
    let heading = trackDeg;
    for (let s = 0; s <= horizonSec; s += stepSec) {
      pts.push(pos);
      pos = deadReckon(pos[0], pos[1], velocityMs, heading, stepSec);
      heading += turnRateDegPerSec * stepSec;
    }
    return pts;
  }