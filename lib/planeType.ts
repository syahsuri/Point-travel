import type { PlaneType } from "@/lib/types";

/** Tailwind classes for the small plane-type pill shown in the flights list. */
export function planeTypeBadgeClass(type: PlaneType | null | undefined): string | null {
    switch (type) {
        case "Military & Special":
            return "bg-rose-500/20 text-rose-300 border-rose-500/40";
        case "Military":
            return "bg-amber-500/20 text-amber-300 border-amber-500/40";
        case "Interesting":
            return "bg-purple-500/20 text-purple-300 border-purple-500/40";
        case "LADD":
            return "bg-slate-500/20 text-slate-300 border-slate-500/40";
        case "Civil":
            return "bg-sky-500/20 text-sky-300 border-sky-500/40";
        default:
            return null;
    }
}

/** Short label for the plane-type pill. */
export function planeTypeShortLabel(type: PlaneType | null | undefined): string | null {
    switch (type) {
        case "Military & Special":
            return "MIL★";
        case "Military":
            return "MIL";
        case "Interesting":
            return "★";
        case "LADD":
            return "LADD";
        case "Civil":
            return "CIV";
        default:
            return null;
    }
}