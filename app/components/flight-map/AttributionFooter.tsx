"use client";

/**
 * Bottom-center attribution credit for the flight data source (OpenSky
 * Network) and site copyright. Static — no props needed.
 */
export default function AttributionFooter() {
  const year = new Date().getFullYear();

  return (
    <div className="pointer-events-none absolute bottom-1 left-4 z-10 flex flex-col gap-0.5 rounded bg-black/40 px-2 py-0.5 text-[9px] text-white/40 backdrop-blur-sm">
      <span>
        Flight Data By:{" "}

        <a href="https://opensky-network.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto text-sky-400 underline hover:text-sky-300"
        >
          OpenSky Network
        </a>
      </span>
      <span>© {year} Point-travel. All rights reserved.</span>
    </div>
  );
}