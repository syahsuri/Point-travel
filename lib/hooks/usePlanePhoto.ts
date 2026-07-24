"use client";

import { useEffect, useState } from "react";
import { loadPlanePhoto } from "@/lib/photos";
import type { PlanePhoto } from "@/lib/types";

type Result = {
  // icao24 this photo/null result corresponds to. Compared against the
  // current `icao24` argument to derive `loading` and `photo` below,
  // instead of tracking a separate `loading` field in state (which would
  // require a synchronous setState call at the top of the effect body).
  key: string | null | undefined;
  photo: PlanePhoto | null;
};

/**
 * Fetches a Planespotters photo for the given ICAO24 hex code whenever it
 * changes. Returns null while loading, on error, or when no photo exists —
 * callers should fall back to a placeholder image in all three cases.
 */
export function usePlanePhoto(icao24: string | null | undefined) {
  const [result, setResult] = useState<Result>({ key: undefined, photo: null });

  useEffect(() => {
    if (!icao24) return;
    let cancelled = false;

    loadPlanePhoto(icao24)
      .then((p) => {
        if (!cancelled) setResult({ key: icao24, photo: p });
      })
      .catch((err) => {
        console.error("[plane-photo]", err);
        if (!cancelled) setResult({ key: icao24, photo: null });
      });

    return () => {
      cancelled = true;
    };
  }, [icao24]);

  // Stale result from a previous icao24 (or the initial null key) should
  // never be shown as this plane's photo, and we're "loading" exactly when
  // we have a target icao24 but haven't resolved a result for it yet.
  const settled = result.key === icao24;
  const photo = settled ? result.photo : null;
  const loading = icao24 != null && !settled;

  return { photo, loading };
}