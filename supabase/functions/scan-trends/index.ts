// Daily Trend & Competitor Radar.
// - Firecrawl searches for fresh items on each pillar keyword
// - Optionally scrapes competitor pages
// - Claude condenses everything into a small set of trend rows the
//   drafter can pull from
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLAUDE_MODEL = "claude-sonnet-4-5";
const INPUT_COST_PER_TOKEN = 3 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000;

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

const TREND_SYSTEM = `You distil web search results into 3-6 LinkedIn-ready TREND ROWS for a CEO ghostwriter (London Royal Academy — AI + executive training).

For each trend, give:
- title (under 12 words, punchy)
- summary (2-3 sentences, plain English, British spelling, no hype)
- angle (one sentence describing the contrarian or specific angle worth taking)
- counter_take (one short sentence — what an operator-CEO would say back, in Hajre's voice: dry, observational, not corporate)
- heat_score (1-10, how hot/timely this is right now)
- source_url (the best single URL from the input)
- pillar (one of: ai_agents | defence_training | academic_research | ceo_journey | curated_commentary)

Hard rules: zero fabrication, only use facts from the supplied items, skip items that are pure press release fluff.

Return ONLY valid JSON, no markdown:
{ "trends": [ { "title": "...", "summary": "...", "angle": "...", "counter_take": "...", "heat_score": 7, "source_url": "...", "pillar": "..." } ] }`;

async function callClaude(apiKey: string, system: string, user: string, maxTokens = 2500) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!r.ok) throw new Error(`Claude API error [${r.status}]: ${await r.text()}`);
  const data = await r.json();
  return {
    text: (data.content?.[0]?.text ?? "").trim(),
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

function stripJsonFence(raw: string): string {
  return raw.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
}

async function firecrawlSearch(apiKey: string, query: string, limit = 5) {
  const r = await fetch(`${FIRECRAWL_V2}/search`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit, tbs: "qdr:w" }), // last week
  });
  if (!r.ok) {
    console.warn(`Firecrawl search failed [${r.status}] for "${query}":`, await r.text());
    return [];
  }
  const data = await r.json();
  // v2 response: { success, data: { web: [{title, url, description}] } } OR { data: [...] }
  const web = data?.data?.web ?? data?.web ?? data?.data ?? [];
  return Array.isArray(web) ? web : [];
}

async function firecrawlScrape(apiKey: string, url: string) {
  try {
    const r = await fetch(`${FIRECRAWL_V2}/scrape`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["summary"], onlyMainContent: true }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data?.data?.summary ?? data?.summary ?? null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!CLAUDE_API_KEY) throw new Error("CLAUDE_API_KEY missing");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY missing — connect the Firecrawl connector");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load CEO context for keywords + competitor URLs
    const { data: ceo } = await supabase
      .from("ceo_context")
      .select("trend_keywords, competitor_urls")
      .limit(1)
      .maybeSingle();

    const keywords: string[] = (ceo?.trend_keywords as string[] | null) ?? [
      "AI agents enterprise",
      "executive AI training",
      "LLM operator playbooks",
    ];
    const competitorUrls: string[] = (ceo?.competitor_urls as string[] | null) ?? [];

    // Collect search results
    type SourceItem = { title: string; url: string; description: string; origin: string };
    const collected: SourceItem[] = [];

    for (const kw of keywords.slice(0, 7)) {
      const results = await firecrawlSearch(FIRECRAWL_API_KEY, kw, 4);
      for (const r of results) {
        if (!r?.url) continue;
        collected.push({
          title: r.title ?? "(untitled)",
          url: r.url,
          description: r.description ?? r.snippet ?? "",
          origin: `search:${kw}`,
        });
      }
    }

    // Scrape competitor URLs (top 3 only — cost control)
    for (const url of competitorUrls.slice(0, 3)) {
      const summary = await firecrawlScrape(FIRECRAWL_API_KEY, url);
      if (summary) {
        collected.push({
          title: `Competitor signal: ${new URL(url).hostname}`,
          url,
          description: typeof summary === "string" ? summary.slice(0, 600) : JSON.stringify(summary).slice(0, 600),
          origin: "competitor",
        });
      }
    }

    if (collected.length === 0) {
      return new Response(JSON.stringify({ status: "success", trends: 0, reason: "no search results" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // De-dupe by URL
    const byUrl = new Map<string, SourceItem>();
    for (const c of collected) if (!byUrl.has(c.url)) byUrl.set(c.url, c);
    const unique = Array.from(byUrl.values()).slice(0, 30);

    const itemBlock = unique
      .map((s, i) => `${i + 1}. [${s.origin}] ${s.title}\n   URL: ${s.url}\n   ${s.description}`)
      .join("\n");

    const userMsg = `RAW WEB ITEMS (last 7 days):\n${itemBlock}\n\nDistil into 3-6 trend rows for the drafter. JSON only.`;
    const claude = await callClaude(CLAUDE_API_KEY, TREND_SYSTEM, userMsg);
    const cost = claude.inputTokens * INPUT_COST_PER_TOKEN + claude.outputTokens * OUTPUT_COST_PER_TOKEN;

    let parsed: any;
    try {
      parsed = JSON.parse(stripJsonFence(claude.text));
    } catch (e) {
      throw new Error(`Trend parse failed: ${e}`);
    }
    const trends: any[] = Array.isArray(parsed?.trends) ? parsed.trends : [];

    // Expire previous trends so the sidebar only shows fresh ones
    await supabase
      .from("trend_radar")
      .delete()
      .lt("expires_at", new Date().toISOString());

    let inserted = 0;
    if (trends.length > 0) {
      const rows = trends
        .filter((t) => t?.title && t?.summary)
        .map((t) => ({
          title: String(t.title).slice(0, 200),
          summary: String(t.summary).slice(0, 1200),
          angle: t.angle ? String(t.angle).slice(0, 500) : null,
          counter_take: t.counter_take ? String(t.counter_take).slice(0, 500) : null,
          source_url: t.source_url ?? null,
          source_type: "search",
          pillar: t.pillar ?? null,
          heat_score: Math.max(1, Math.min(10, Number(t.heat_score ?? 5))),
          expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        }));
      if (rows.length > 0) {
        const { error: insErr, count } = await supabase
          .from("trend_radar")
          .insert(rows, { count: "exact" });
        if (insErr) throw new Error(`insert trend_radar: ${insErr.message}`);
        inserted = count ?? rows.length;
      }
    }

    await supabase.from("agent_log").insert({
      action: "trends_scanned",
      api_cost_usd: parseFloat(cost.toFixed(6)),
      tokens_used: claude.inputTokens + claude.outputTokens,
      details: {
        keywords_used: keywords.length,
        competitor_urls: competitorUrls.length,
        raw_items: unique.length,
        trends_inserted: inserted,
        model: CLAUDE_MODEL,
      },
    });

    return new Response(
      JSON.stringify({ status: "success", trends: inserted, raw_items: unique.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("scan-trends error:", e);
    return new Response(
      JSON.stringify({ status: "error", error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
