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