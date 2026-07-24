import type { NextRequest } from "next/server";
import type { PlanePhoto } from "@/lib/types";

export const dynamic = "force-dynamic";

const USER_AGENT = "PointTravel/1.0 (https://flight.gukgukcraft.id)";
const ALLOWED_HOST = "flight.gukgukcraft.id";

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

function isSameOriginRequest(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const candidate = origin ?? referer;
  if (!candidate) return false;

  try {
    return new URL(candidate).host === ALLOWED_HOST;
  } catch {
    return false;
  }
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
        headers: { "Cache-Control": "s-maxage=86400, stale-while-revalidate=3600" },
      }
    );
  } catch (err) {
    console.error("[/api/photos]", err);
    return Response.json({ photo: null });
  }
}