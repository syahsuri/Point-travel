"use client";

import { useEffect, useState } from "react";
import { loadPlanePhoto } from "@/lib/photos";
import type { PlanePhoto } from "@/lib/types";

/**
 * Fetches a Planespotters photo for the given ICAO24 hex code whenever it
 * changes. Returns null while loading, on error, or when no photo exists —
 * callers should fall back to a placeholder image in all three cases.
 */
export function usePlanePhoto(icao24: string | null | undefined) {
  const [photo, setPhoto] = useState<PlanePhoto | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!icao24) {
      setPhoto(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadPlanePhoto(icao24)
      .then((p) => {
        if (!cancelled) setPhoto(p);
      })
      .catch((err) => {
        console.error("[plane-photo]", err);
        if (!cancelled) setPhoto(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [icao24]);

  return { photo, loading };
}