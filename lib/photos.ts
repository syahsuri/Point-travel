import type { PlanePhoto } from "@/lib/types";

export async function loadPlanePhoto(hex: string): Promise<PlanePhoto | null> {
  const res = await fetch(`/api/photos/${encodeURIComponent(hex)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { photo: PlanePhoto | null };
  return data.photo;
}