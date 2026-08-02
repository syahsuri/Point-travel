"use client";

import { useState } from "react";

/**
 * Custom map attribution control. Per OSM's Attribution Guidelines,
 * attribution must be visible WITHOUT requiring interaction when the
 * map first loads — it may only be collapsed to an icon AFTER the user
 * has seen it and chosen to dismiss it (e.g. via an "X").
 * https://osmfoundation.org/wiki/Licence/Attribution_Guidelines
 */
export default function MapAttribution() {
    const [open, setOpen] = useState(true); // visible by default

    return (
        <div className="absolute bottom-1 right-2 z-10">
            {open ? (
                <div className="flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[9px] text-white/70 backdrop-blur">
                    <span>
                        © Esri | Basemap © Natural Earth (public domain) |{" "}

                        <a href="https://www.openstreetmap.org/copyright"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-white"
                        >
                            OpenStreetMap contributors
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
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-[11px] font-semibold text-white/70 backdrop-blur hover:bg-black/70 hover:text-white transition-colors"
                >
                    i
                </button>
            )}
        </div>
    );
}