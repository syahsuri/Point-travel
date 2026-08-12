const CATEGORY_ICON_CODE: Record<number, string> = {
    0: "a0",
    1: "a0",
    2: "a1",
    3: "a2",
    4: "a3",
    5: "a4",
    6: "a5",
    7: "a6",
    8: "a7",
    9: "b1",
    10: "b2",
    11: "b3",
    12: "b4",
    16: "c0",
    17: "c0",
    18: "c0",
    19: "c0",
    20: "c0",
};

export function categoryIconSrc(category: number | null | undefined): string {
    const code = category != null ? CATEGORY_ICON_CODE[category] : undefined;
    return `/icons/planes-category/${code ?? "a0"}.svg`;
}

/** All distinct icon codes actually in use (for bulk pre-loading into MapLibre). */
export const ALL_CATEGORY_ICON_CODES = Array.from(
    new Set(Object.values(CATEGORY_ICON_CODE))
).concat("a0"); // ensure the fallback is always included

/** category number -> MapLibre image name (must match what gets loaded). */
export function categoryIconName(category: number | null | undefined): string {
    const code = category != null ? CATEGORY_ICON_CODE[category] : undefined;
    return `plane-cat-${code ?? "a0"}`;
}