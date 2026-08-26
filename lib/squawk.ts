export type SquawkAlertLevel = "emergency" | "operational" | null;

const EMERGENCY_SQUAWKS = new Set(["7700", "7600", "7500"]);
const OPERATIONAL_SQUAWKS = new Set(["1200", "7000", "7777", "0000"]);

/**
 * Classifies a squawk code into an alert tier for badge styling:
 * - "emergency": 7700 (general emergency), 7600 (radio failure/NORDO),
 *   7500 (hijack) — red/flashing treatment.
 * - "operational": 1200/7000 (VFR), 7777 (military intercept/testing),
 *   0000 (discrete/unassigned) — yellow/info treatment.
 * - null: normal/assigned ATC code, no badge.
 */
export function squawkAlertLevel(squawk: string | null | undefined): SquawkAlertLevel {
    if (!squawk) return null;
    const code = squawk.trim();
    if (EMERGENCY_SQUAWKS.has(code)) return "emergency";
    if (OPERATIONAL_SQUAWKS.has(code)) return "operational";
    return null;
}

const SQUAWK_LABELS: Record<string, string> = {
    "7700": "Emergency",
    "7600": "Radio Failure",
    "7500": "Hijack",
    "1200": "VFR",
    "7000": "VFR",
    "7777": "Military Intercept",
    "0000": "Discrete/Unassigned",
};

/** Human-readable label for a squawk code, if it's one of the known special codes. */
export function squawkLabel(squawk: string | null | undefined): string | null {
    if (!squawk) return null;
    return SQUAWK_LABELS[squawk.trim()] ?? null;
}