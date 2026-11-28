"use client";

import { useState } from "react";

const LINK = "pointer-events-auto underline hover:text-white";

/**
 * All credits in one box: flight data, aircraft icons, basemap. Per OSM's
 * Attribution Guidelines, attribution must be visible WITHOUT requiring
 * interaction when the map first loads — it may only be collapsed to an
 * icon AFTER the user has seen it and chosen to dismiss it (e.g. via an "X").
 * https://osmfoundation.org/wiki/Licence/Attribution_Guidelines
 */
export default function MapAttribution() {
    const [open, setOpen] = useState(true); // visible by default

    return open ? (
        <div className="pointer-events-auto flex items-start gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[9px] leading-snug text-white/70 backdrop-blur">
            <span>
                Flight data{" "}
                <a href="https://opensky-network.org/" target="_blank" rel="noopener noreferrer" className={LINK}>
                    OpenSky Network
                </a>
                {" · "}Icons{" "}
                <a href="https://adsb-radar.com/help/icons.html" target="_blank" rel="noopener noreferrer" className={LINK}>
                    adsb-radar
                </a>
                {" · "}© Esri · Natural Earth ·{" "}
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className={LINK}>
                    © OpenStreetMap contributors
                </a>
            </span>
            <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Hide attribution"
                className="shrink-0 text-white/50 hover:text-white"
            >
                ✕
            </button>
        </div>
    ) : (
        <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Show map attribution"
            title="Map attribution"
            className="pointer-events-auto flex h-6 w-6 items-center justify-center self-end rounded-full bg-black/50 text-[11px] font-semibold text-white/70 backdrop-blur hover:bg-black/70 hover:text-white transition-colors"
        >
            i
        </button>
    );
}
