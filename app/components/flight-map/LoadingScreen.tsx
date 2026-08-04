"use client";

type LoadingScreenProps = {
  visible: boolean;
};

export default function LoadingScreen({ visible }: LoadingScreenProps) {
  return (
    <div
      className={`absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#0b1622] transition-opacity duration-500 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-white/10 border-t-sky-400" />
        <span className="text-2xl">✈</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-semibold tracking-wide text-white">
          Point Travel
        </span>
        <span className="text-xs text-white/40">Loading live flights…</span>
      </div>
    </div>
  );
}