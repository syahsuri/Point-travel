import type { StateVector } from "@/lib/types";

const CACHE_KEY = "point-travel:planes-cache";

export type PlanesCache = {
  time: number; // backend res.time (unix seconds)
  fetchedAt: number; // client Date.now() when this was fetched
  states: StateVector[];
};

/**
 * Reads the last-fetched planes snapshot from localStorage, if any. Used so
 * a page refresh can reuse recent data instead of immediately re-calling
 * the backend — the API should be driven by its own schedule, not by
 * whether the user happened to reload the tab.
 */
export function readPlanesCache(): PlanesCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlanesCache;
    if (!Array.isArray(parsed.states) || typeof parsed.fetchedAt !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePlanesCache(cache: PlanesCache) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage disabled/full — non-fatal, just means no cross-refresh cache.
  }
}