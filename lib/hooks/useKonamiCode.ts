"use client";

import { useEffect, useRef } from "react";
import { KONAMI_CODE } from "@/lib/mapConstants";

/**
 * Listens for the Konami code sequence
 */
export function useKonamiCode(onTrigger: () => void) {
  const indexRef = useRef(0);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const expected = KONAMI_CODE[indexRef.current];
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === expected) {
        indexRef.current += 1;
        if (indexRef.current === KONAMI_CODE.length) {
          indexRef.current = 0;
          onTrigger();
        }
      } else {
        indexRef.current = key === KONAMI_CODE[0] ? 1 : 0;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onTrigger]);
}