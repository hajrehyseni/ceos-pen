// Competitor CEO watch: scrapes each watched profile / recent-activity
// URL via Firecrawl and asks Claude to extract talking points that
// Hajrë could react to (agree, disagree, or extend).
//
// Loads competitors from public.competitor_watch where active = true.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { embedOne } from "../_shared/embeddings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLAUDE_MODEL = "claude-sonnet-4-5";
const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

const EXTRACT_SYSTEM = `You read the public activity of a competitor CEO and extract 1-3 fresh talking points that Hajrë Hyseni (London Royal Academy — AI + executive training) could react to.

For each talking point return:
- claim: what they said, in one sentence, plain English
- angle: how Hajrë should react (agree/extend, disagree with evidence, or reframe as operator)
- counter_take: one sharp sentence in Hajrë's voice — British, dry, warm, no jargon
- heat_score: 1-10 (how contested/timely the claim is)

Skip anything older than ~10 days, self-promotional links with no argument, or job posts.

Return ONLY JSON: { "items": [{ "claim": "...", "angle": "...", "counter_take": "...", "heat_score": 6 }] }`;

async function firecrawlScrape(url: string): Promise<string> {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) throw new Error("Missing FIRECRAWL_API_KEY");
  const r = await fetch(`${FIRECRAWL_V2}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });
  if (!r.ok) throw new Error(`Firecrawl [${r.status}]: ${await r.text()}`);
  const data = await r.json();
  return (data.markdown ?? data.data?.markdown ?? "").slice(0, 8000);
}

async function callClaude(apiKey: string, user: string) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      system: EXTRACT_SYSTEM,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!r.ok) throw new Error(`Claude [${r.status}]: ${await r.text()}`);
  const data = await r.json();
  const text = (data.content?.[0]?.text ?? "").trim();
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
  try { return { parsed: JSON.parse(cleaned), usage: data.usage }; }
  catch { return { parsed: { items: [] }, usage: data.usage }; }
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

  const { data: watch } = await supabase
    .from("competitor_watch")
    .select("id, handle, name, profile_url")
    .eq("active", true);

  if (!watch || watch.length === 0) {
    return new Response(JSON.stringify({ inserted: 0, note: "No active competitors" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  let totalInserted = 0;
  let totalCost = 0;

  for (const c of watch) {
    if (!c.profile_url) continue;
    try {
      const markdown = await firecrawlScrape(c.profile_url);
      if (!markdown || markdown.length < 200) continue;

      const user = `Competitor: ${c.name ?? c.handle}\nURL: ${c.profile_url}\n\nRECENT PUBLIC ACTIVITY (markdown):\n${markdown}`;
      const { parsed, usage } = await callClaude(claudeKey, user);
      const inCost = ((usage?.input_tokens ?? 0) * 3) / 1_000_000;
      const outCost = ((usage?.output_tokens ?? 0) * 15) / 1_000_000;
      totalCost += inCost + outCost;

      const items = Array.isArray(parsed.items) ? parsed.items.slice(0, 3) : [];
      for (const it of items) {
        const angle = `${it.angle ?? ""} (via ${c.name ?? c.handle})`;
        const embedding = await embedOne(angle);
        await supabase.from("trend_radar").insert({
          title: (it.claim ?? "Competitor talking point").slice(0, 220),
          summary: (it.claim ?? "").slice(0, 600),
          angle,
          counter_take: it.counter_take ?? "",
          source_url: c.profile_url,
          source_type: "competitor",
          pillar: "curated_commentary",
          heat_score: Number(it.heat_score ?? 6),
          angle_embedding: embedding,
          expires_at: expiresAt,
        });
        totalInserted += 1;
      }

      await supabase
        .from("competitor_watch")
        .update({ last_checked_at: new Date().toISOString() })
        .eq("id", c.id);
    } catch (e) {
      console.error(`competitor ${c.handle} failed:`, e);
    }
  }

  await supabase.from("agent_log").insert({
    action: "collect_competitors",
    api_cost_usd: Number(totalCost.toFixed(6)),
    tokens_used: 0,
    details: { inserted: totalInserted, watched: watch.length },
  });

  return new Response(JSON.stringify({ inserted: totalInserted, watched: watch.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
