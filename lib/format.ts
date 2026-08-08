// Display/formatting helpers for the flight map. No React, no map access.

/**
 * Compact "updated Xm ago" from an ISO timestamp. Backend sends naive ISO
 * (no tz) meaning UTC — append Z so it's not read as local. "" if null/invalid.
 */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const withTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const ms = Date.parse(withTz);
  if (Number.isNaN(ms)) return "";
  const secs = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/**
 * Parse an ISO position timestamp to unix seconds. Backend sends naive ISO
 * (no tz) meaning UTC — append Z. NaN when null/invalid.
 */
export function posSecs(iso: string | null | undefined): number {
  if (!iso) return NaN;
  const withTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const ms = Date.parse(withTz);
  return Number.isNaN(ms) ? NaN : ms / 1000;
}

/**
 * Format an ISO timestamp as WIB (UTC+7), e.g. "2026-07-14 15:30 WIB".
 * Backend sends naive ISO (no tz) meaning UTC — append Z, then shift +7h.
 * Null-safe.
 */
export function fmtSched(iso: string | null): string | null {
  if (!iso) return null;
  const withTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const ms = Date.parse(withTz);
  if (Number.isNaN(ms)) return null;
  const wib = new Date(ms + 7 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(
    wib.getUTCDate()
  )} ${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())} WIB`;
}

const STATUS_TEXT_COLOR: Record<string, string> = {
  EnRoute: "text-sky-400",
  Scheduled: "text-amber-400",
  Landed: "text-emerald-400",
};

/**
 * Tailwind text-color class for a flight-schedule board status
 * ("EnRoute" / "Scheduled" / "Landed" / etc). Falls back to a neutral gray.
 */
export function statusTextClass(status: string | null | undefined): string {
  if (!status) return "text-white/45";
  return STATUS_TEXT_COLOR[status] ?? "text-white/45";
}

const AIRCRAFT_CATEGORY_LABELS: Record<number, string> = {
  0: "No info",
  1: "Unknown type",
  2: "Light",
  3: "Small",
  4: "Large",
  5: "High vortex large",
  6: "Heavy",
  7: "High performance",
  8: "Rotorcraft",
  9: "Glider / sailplane",
  10: "Lighter-than-air",
  11: "Parachutist / skydiver",
  12: "Ultralight / paraglider",
  13: "Reserved",
  14: "UAV",
  15: "Space vehicle",
  16: "Emergency vehicle",
  17: "Service vehicle",
  18: "Point obstacle",
  19: "Cluster obstacle",
  20: "Line obstacle",
};

/**
 * Human-readable ADS-B emitter category. Null for 0/1/null since those
 * carry no real information and aren't worth a sidebar row.
 */
export function aircraftCategoryLabel(
  category: number | null | undefined
): string | null {
  if (category == null || category === 0 || category === 1) return null;
  return AIRCRAFT_CATEGORY_LABELS[category] ?? null;
}

export type CategoryVisual = { label: string; icon: string; className: string };

const CATEGORY_VISUALS: Record<number, CategoryVisual> = {
  2: { label: "Light", icon: "✈", className: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  3: { label: "Small", icon: "✈", className: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  4: { label: "Large", icon: "✈", className: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  5: { label: "High vortex large", icon: "✈", className: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  6: { label: "Heavy", icon: "✈", className: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  7: { label: "High performance", icon: "⚡", className: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  8: { label: "Rotorcraft", icon: "🚁", className: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  9: { label: "Glider", icon: "🪂", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  10: { label: "Lighter-than-air", icon: "🎈", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  11: { label: "Parachutist", icon: "🪂", className: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
  12: { label: "Ultralight", icon: "🪁", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  14: { label: "UAV", icon: "🛸", className: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
  15: { label: "Space vehicle", icon: "🚀", className: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  16: { label: "Emergency vehicle", icon: "🚨", className: "bg-red-500/15 text-red-300 border-red-500/30" },
  17: { label: "Service vehicle", icon: "🚙", className: "bg-white/10 text-white/70 border-white/20" },
  18: { label: "Point obstacle", icon: "⚠", className: "bg-white/10 text-white/70 border-white/20" },
  19: { label: "Cluster obstacle", icon: "⚠", className: "bg-white/10 text-white/70 border-white/20" },
  20: { label: "Line obstacle", icon: "⚠", className: "bg-white/10 text-white/70 border-white/20" },
};

/**
 * Badge-friendly rendering of an ADS-B category: icon + label + Tailwind
 * classes for a colored pill. Null for 0/1/13/unmapped — nothing worth badging.
 */
export function aircraftCategoryVisual(
  category: number | null | undefined
): CategoryVisual | null {
  if (category == null) return null;
  return CATEGORY_VISUALS[category] ?? null;
}