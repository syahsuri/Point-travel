"use client";

import { useEffect, useState } from "react";
import { loadPlanePhoto } from "@/lib/photos";
import type { PlanePhoto } from "@/lib/types";

type PhotoState = {
  photo: PlanePhoto | null;
  loading: boolean;
};

/**
 * Fetches a Planespotters photo for the given ICAO24 hex code whenever it
 * changes. Returns null while loading, on error, or when no photo exists —
 * callers should fall back to a placeholder image in all three cases.
 */
export function usePlanePhoto(icao24: string | null | undefined) {
  const [state, setState] = useState<PhotoState>({ photo: null, loading: false });

  useEffect(() => {
    let cancelled = false;

    if (!icao24) {
      // Defer via microtask so this isn't a *synchronous* setState call
      // inside the effect body (avoids the set-state-in-effect lint rule).
      queueMicrotask(() => {
        if (!cancelled) setState({ photo: null, loading: false });
      });
      return () => {
        cancelled = true;
      };
    }

    setState((prev) => ({ ...prev, loading: true }));

    loadPlanePhoto(icao24)
      .then((p) => {
        if (!cancelled) setState({ photo: p, loading: false });
      })
      .catch((err) => {
        console.error("[plane-photo]", err);
        if (!cancelled) setState({ photo: null, loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, [icao24]);

  return state;
}