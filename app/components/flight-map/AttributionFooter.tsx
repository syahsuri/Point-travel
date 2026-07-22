"use client";

/**
 * Bottom-center attribution credit for the flight data source (OpenSky
 * Network). Static — no props needed.
 */
export default function AttributionFooter() {
  return (
    <div className="pointer-events-none absolute bottom-1 left-1/2 z-10 -translate-x-1/2 rounded bg-black/40 px-2 py-0.5 text-[9px] text-white/40 backdrop-blur-sm">
      Flight Data By:{" "}
      <a
        href="https://opensky-network.org/"
        target="_blank"
        rel="noopener noreferrer"
        className="pointer-events-auto text-sky-400 underline hover:text-sky-300"
      >
        OpenSky Network
      </a>
    </div>
  );
}
