import type { NextRequest } from "next/server";
import type { PlanePhoto } from "@/lib/types";
import { isSameOriginRequest } from "@/lib/sameOrigin";

/**
 * Server-side proxy for Planespotters' public Photo API.
 *
 * Per Planespotters' Photo API terms:
 * - Server-side requests must send a unique, descriptive User-Agent with a
 *   contact URL (generic library defaults are discouraged/blocked).
 * - JSON responses may be cached up to 24h — we set Cache-Control accordingly.
 * - Image binaries must NEVER be downloaded/re-hosted — this route only
 *   forwards the JSON (with its original, unmodified URLs); the browser
 *   loads the actual thumbnail images directly from Planespotters' CDN.
 * - All returned URLs (thumbnail, thumbnail_large, link) must be passed
 *   through unchanged — no rewriting/proxying.
 * - This route must not be re-exposed as a general-purpose public API, so
 *   we restrict it to same-origin requests from our own frontend.
 */
export const dynamic = "force-dynamic";

// NOTE: replace with your actual deployed domain/contact per Planespotters'
// terms — a generic User-Agent may get throttled or blocked.
const USER_AGENT = "PointTravel/1.0 (https://flight.co.id, https://flight.gukgukcraft.id)";
// Hosts allowed to call this route. Add localhost so local dev still works.

type RawPhoto = {
  id?: string;
  thumbnail?: { src?: string; size?: { width?: number; height?: number } };
  thumbnail_large?: { src?: string; size?: { width?: number; height?: number } };
  link?: string;
  photographer?: string;
};

function toPlanePhoto(r: RawPhoto): PlanePhoto | null {
  if (!r.thumbnail?.src || !r.thumbnail_large?.src || !r.link) return null;
  return {
    id: r.id ?? "",
    thumbnail: {
      src: r.thumbnail.src,
      width: r.thumbnail.size?.width ?? 200,
      height: r.thumbnail.size?.height ?? 133,
    },
    thumbnailLarge: {
      src: r.thumbnail_large.src,
      width: r.thumbnail_large.size?.width ?? 420,
      height: r.thumbnail_large.size?.height ?? 280,
    },
    link: r.link,
    photographer: r.photographer ?? "Unknown",
  };
}


export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/photos/[hex]">
) {
  if (!isSameOriginRequest(req)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { hex } = await ctx.params;

  try {
    const res = await fetch(
      `https://api.planespotters.net/pub/photos/hex/${encodeURIComponent(hex)}`,
      {
        headers: { "User-Agent": USER_AGENT },
        cache: "no-store",
      }
    );

    if (!res.ok) throw new Error(`planespotters ${res.status}`);

    const raw = (await res.json()) as { photos?: RawPhoto[]; error?: string };
    if (raw.error) {
      return Response.json({ photo: null });
    }

    const photo = raw.photos?.[0] ? toPlanePhoto(raw.photos[0]) : null;

    return Response.json(
      { photo },
      {
        // Terms allow caching the JSON response up to 24h.
        headers: { "Cache-Control": "s-maxage=86400, stale-while-revalidate=3600" },
      }
    );
  } catch (err) {
    console.error("[/api/photos]", err);
    return Response.json({ photo: null });
  }
}