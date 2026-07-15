// Generates a weekly CEO brief:
//   - What worked (top posts by engagement)
//   - What flopped (bottom posts + patterns)
//   - Best pillar × time-of-day slot
//   - Cost per engaged impression
//   - 3 prescriptive recommendations for next week
//
// Stored in public.weekly_briefs so the dashboard can render the latest one.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLAUDE_MODEL = "claude-sonnet-4-5";

const BRIEF_SYSTEM = `You are a no-nonsense chief of staff writing a weekly LinkedIn brief for Hajrë Hyseni (CEO, London Royal Academy).

Given the raw performance data, write a tight brief in British English. Structure:

## What worked
2-3 bullets with the concrete post + why it landed.

## What flopped
1-2 bullets, dry and honest, plus the pattern to avoid.

## Best slot
The single pillar × time-of-day that produced the strongest engagement, with numbers.

## Cost efficiency
Cost per engaged impression this week vs last week, plus what that implies.

## Do this next week
3 crisp recommendations (imperative voice, no fluff).

Rules: no emojis, no hashtags, no corporate cliches, no hedging. If data is thin, say so.

Also return a JSON object of the same recommendations as an array so the app can render them separately.

Return ONLY JSON: { "summary_md": "...", "recommendations": ["...", "...", "..."] }`;

function startOfIsoWeek(d: Date): Date {
  const day = d.getUTCDay() || 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (day - 1));
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

async function callClaude(apiKey: string, user: string) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2500,
      system: BRIEF_SYSTEM,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!r.ok) throw new Error(`Claude [${r.status}]: ${await r.text()}`);
  const data = await r.json();
  const text = (data.content?.[0]?.text ?? "").trim();
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
  try { return { parsed: JSON.parse(cleaned), usage: data.usage }; }
  catch { return { parsed: { summary_md: text, recommendations: [] }, usage: data.usage }; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const claudeKey = Deno.env.get("CLAUDE_API_KEY");
  if (!claudeKey) {
    return new Response(JSON.stringify({ error: "Missing CLAUDE_API_KEY" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = new Date();
  const weekStart = startOfIsoWeek(now);
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7);

  const { data: posts } = await supabase
    .from("posts")
    .select("id, content, pillar, hook_pattern, published_at, virality_score, engagement_estimate")
    .eq("status", "published")
    .gte("published_at", prevWeekStart.toISOString())
    .order("published_at", { ascending: false });

  const { data: metrics } = await supabase
    .from("post_metrics")
    .select("post_id, likes, comments, reposts, impressions, engagement_rate");

  const { data: logs } = await supabase
    .from("agent_log")
    .select("api_cost_usd, created_at")
    .gte("created_at", prevWeekStart.toISOString());

  const byId = new Map<string, any>();
  for (const m of metrics ?? []) byId.set(m.post_id, m);

  const enriched = (posts ?? []).map((p) => {
    const m = byId.get(p.id) ?? { likes: 0, comments: 0, reposts: 0, impressions: 0 };
    const engaged = m.likes + 2 * m.comments + 3 * m.reposts;
    return {
      ...p,
      likes: m.likes, comments: m.comments, reposts: m.reposts,
      impressions: m.impressions ?? 0, engaged,
      hour: p.published_at ? new Date(p.published_at).getUTCHours() : null,
      is_this_week: p.published_at && new Date(p.published_at) >= weekStart,
    };
  });

  const thisWeek = enriched.filter((p) => p.is_this_week);
  const lastWeek = enriched.filter((p) => !p.is_this_week);

  const sumEngaged = (arr: any[]) => arr.reduce((s, p) => s + p.engaged, 0);
  const sumImp = (arr: any[]) => arr.reduce((s, p) => s + (p.impressions || 0), 0);
  const sumCost = (from: Date, to: Date) =>
    (logs ?? [])
      .filter((l) => {
        const t = new Date(l.created_at);
        return t >= from && t < to;
      })
      .reduce((s, l) => s + Number(l.api_cost_usd || 0), 0);

  const thisCost = sumCost(weekStart, now);
  const lastCost = sumCost(prevWeekStart, weekStart);
  const cpeThis = sumEngaged(thisWeek) > 0 ? thisCost / sumEngaged(thisWeek) : null;
  const cpeLast = sumEngaged(lastWeek) > 0 ? lastCost / sumEngaged(lastWeek) : null;

  const metricsPayload = {
    this_week_posts: thisWeek.length,
    last_week_posts: lastWeek.length,
    this_week_engaged: sumEngaged(thisWeek),
    last_week_engaged: sumEngaged(lastWeek),
    this_week_impressions: sumImp(thisWeek),
    this_week_cost_usd: Number(thisCost.toFixed(4)),
    last_week_cost_usd: Number(lastCost.toFixed(4)),
    cost_per_engaged_this_week: cpeThis !== null ? Number(cpeThis.toFixed(5)) : null,
    cost_per_engaged_last_week: cpeLast !== null ? Number(cpeLast.toFixed(5)) : null,
  };

  const topThisWeek = [...thisWeek].sort((a, b) => b.engaged - a.engaged).slice(0, 3);
  const flops = [...thisWeek].sort((a, b) => a.engaged - b.engaged).slice(0, 2);

  const userMessage = `WEEK STARTING: ${weekStart.toISOString().slice(0, 10)}

METRICS:
${JSON.stringify(metricsPayload, null, 2)}

TOP POSTS THIS WEEK:
${topThisWeek.map((p, i) => `${i + 1}. [${p.pillar} / ${p.hook_pattern ?? "?"} / eng=${p.engaged}]\n${(p.content ?? "").slice(0, 400)}`).join("\n\n")}

FLOPS THIS WEEK:
${flops.map((p, i) => `${i + 1}. [${p.pillar} / ${p.hook_pattern ?? "?"} / eng=${p.engaged}]\n${(p.content ?? "").slice(0, 300)}`).join("\n\n")}`;

  const { parsed, usage } = await callClaude(claudeKey, userMessage);

  const inCost = ((usage?.input_tokens ?? 0) * 3) / 1_000_000;
  const outCost = ((usage?.output_tokens ?? 0) * 15) / 1_000_000;

  const weekStartDate = weekStart.toISOString().slice(0, 10);
  const { error } = await supabase.from("weekly_briefs").upsert({
    week_start: weekStartDate,
    summary_md: parsed.summary_md ?? "(no summary)",
    metrics: metricsPayload,
    recommendations: parsed.recommendations ?? [],
  }, { onConflict: "week_start" });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabase.from("agent_log").insert({
    action: "weekly_brief_generated",
    api_cost_usd: Number((inCost + outCost).toFixed(6)),
    tokens_used: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
    details: { week_start: weekStartDate, ...metricsPayload },
  });

  return new Response(JSON.stringify({ week_start: weekStartDate, metrics: metricsPayload }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
