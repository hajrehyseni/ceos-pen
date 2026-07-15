import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tools we track for the "tool tips" pillar. Each query hits HN Algolia which
// requires no API key. We also pull the top HN comments URL as a source.
const TOOL_QUERIES = [
  "Claude Code",
  "Codex CLI",
  "Cursor editor",
  "n8n workflow",
  "Hugging Face",
  "Lovable dev",
  "Perplexity API",
  "Gemini CLI",
  "LangGraph",
  "OpenAI Agents SDK",
];

async function fetchHnItems(query: string): Promise<Array<{ title: string; url: string; source: string; summary: string; points: number }>> {
  // Sort by date, filter to stories with points >= 20 in last 14 days.
  const fourteenDaysAgo = Math.floor(Date.now() / 1000) - 14 * 86400;
  const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story&numericFilters=created_at_i>${fourteenDaysAgo},points>=15&hitsPerPage=5`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.hits ?? [])
      .filter((h: any) => h.title && (h.url || h.story_url))
      .map((h: any) => ({
        title: String(h.title),
        url: String(h.url ?? h.story_url ?? `https://news.ycombinator.com/item?id=${h.objectID}`),
        source: `HN · ${query}`,
        summary: `${h.points ?? 0} points, ${h.num_comments ?? 0} comments. ${(h.story_text || h.comment_text || "").slice(0, 400)}`.trim(),
        points: Number(h.points ?? 0),
      }));
  } catch (e) {
    console.error(`HN fetch failed for ${query}:`, e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const batches = await Promise.all(TOOL_QUERIES.map(fetchHnItems));
    const items = batches.flat();

    // Dedupe by URL then by normalised title.
    const seen = new Set<string>();
    const unique = items.filter((i) => {
      const key = i.url.split("?")[0];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Skip items whose URL we already stored.
    const urls = unique.map((i) => i.url);
    const { data: existing } = await supabase
      .from("news_items").select("url").in("url", urls);
    const existingUrls = new Set((existing ?? []).map((r: any) => r.url));
    const fresh = unique.filter((i) => !existingUrls.has(i.url)).slice(0, 30);

    let inserted = 0;
    if (fresh.length > 0) {
      const rows = fresh.map((i) => ({
        title: i.title.slice(0, 500),
        source: i.source.slice(0, 200),
        url: i.url,
        summary: i.summary.slice(0, 1000),
        relevance_score: Math.min(10, Math.max(3, Math.round(i.points / 30))),
        pillar_match: "tool_tips",
      }));
      const { data: ins, error } = await supabase.from("news_items").insert(rows).select("id");
      if (error) throw new Error(`Insert failed: ${error.message}`);
      inserted = ins?.length ?? 0;
    }

    await supabase.from("agent_log").insert({
      action: "tool_tips_collected",
      api_cost_usd: 0,
      tokens_used: 0,
      details: { source: "hn_algolia", queries: TOOL_QUERIES.length, unique: unique.length, inserted },
    });

    return new Response(
      JSON.stringify({ status: "success", inserted, unique: unique.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("collect-tool-tips error:", e);
    return new Response(
      JSON.stringify({ status: "error", error: e.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
