// Dynamic slot picker: chooses the UTC HH:MM:SS with the best average
// engagement across the last 30 days of post_metrics × posts.published_at.
// Falls back to a sensible UK-lunchtime default if there isn't enough data.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const FALLBACK_SLOTS = ["07:30:00", "12:15:00", "17:00:00", "20:30:00"];

export async function pickDynamicSlot(
  supabase: ReturnType<typeof createClient>,
  pillar?: string | null,
): Promise<string> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let q = supabase
    .from("posts")
    .select("published_at, pillar, post_metrics(likes,comments,reposts)")
    .eq("status", "published")
    .gte("published_at", since);
  if (pillar) q = q.eq("pillar", pillar);
  const { data } = await q;
  if (!data || data.length < 5) {
    return FALLBACK_SLOTS[Math.floor(Math.random() * FALLBACK_SLOTS.length)];
  }
  const buckets = new Map<string, { total: number; count: number }>();
  for (const row of data as any[]) {
    if (!row.published_at) continue;
    const d = new Date(row.published_at);
    const key = `${String(d.getUTCHours()).padStart(2, "0")}:${d.getUTCMinutes() < 30 ? "00" : "30"}:00`;
    const eng = (row.post_metrics ?? []).reduce(
      (s: number, m: any) => s + (m.likes ?? 0) + 2 * (m.comments ?? 0) + 3 * (m.reposts ?? 0),
      0,
    );
    const b = buckets.get(key) ?? { total: 0, count: 0 };
    b.total += eng;
    b.count += 1;
    buckets.set(key, b);
  }
  let best = FALLBACK_SLOTS[1];
  let bestAvg = -1;
  for (const [slot, { total, count }] of buckets) {
    const avg = total / Math.max(1, count);
    if (avg > bestAvg) {
      bestAvg = avg;
      best = slot;
    }
  }
  return best;
}
