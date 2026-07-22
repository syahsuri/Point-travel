"use client";

type ChaosOverlayProps = {
  active: boolean;
};

/**
 * Full-screen Konami-code easter egg: starfield + disco color-cycle overlay
 */
export default function ChaosOverlay({ active }: ChaosOverlayProps) {
  if (!active) return null;
  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        <div className="chaos-starfield" />
      </div>
      <div
        className="pointer-events-none absolute inset-0 disco-overlay"
        style={{ zIndex: 15 }}
      />
      <div className="pointer-events-none absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-fuchsia-300/50 bg-black/70 px-4 py-1.5 backdrop-blur">
        <img src="/icons/nyan-cat.gif" alt="" className="h-6 w-6 shrink-0" />
        <span
          className="text-xs font-bold tracking-wide text-transparent"
          style={{
            backgroundImage:
              "linear-gradient(90deg, #ff2b2b, #ff9500, #ffe600, #33dd33, #00a3ff, #8a2be2)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
          }}
        >
          CHAOS MODE ACTIVATED
        </span>
        <img
          src="/icons/nyan-cat.gif"
          alt=""
          className="h-6 w-6 shrink-0 -scale-x-100"
        />
      </div>
    </>
  );
}