import type { ScheduleEntry } from "@/lib/types";

export async function loadSchedule(
  iata: string,
  type: "A" | "D",
  limit = 50
): Promise<ScheduleEntry[]> {
  const res = await fetch(`/api/schedule/${iata}/${type}/${limit}`);
  if (!res.ok) throw new Error(`schedule ${res.status}`);
  return res.json();
}