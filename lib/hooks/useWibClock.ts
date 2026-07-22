"use client";

import { useEffect, useState } from "react";

/**
 * Live clock showing the current time in WIB (UTC+7), ticking every second.
 * Formats as "HH:MM:SS". Fully self-contained — no external state needed.
 */
export function useWibClock(): string {
  const [nowWib, setNowWib] = useState<string>("");

  useEffect(() => {
    function tick() {
      const wib = new Date(Date.now() + 7 * 3600 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      setNowWib(
        `${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}:${pad(
          wib.getUTCSeconds()
        )}`
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return nowWib;
}