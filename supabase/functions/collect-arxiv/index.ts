// Pulls the freshest arXiv papers for AI/ML/agents/defence-relevant
// categories and lands the notable ones as trend_radar rows so the
// drafter can react to real research, not just news.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { embedOne } from "../_shared/embeddings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// arXiv categories mapped to pillars.
const PILLAR_QUERIES: Record<string, string> = {
  ai_agents: "cat:cs.AI+OR+cat:cs.MA+OR+cat:cs.CL",
  academic_research: "cat:cs.LG+OR+cat:stat.ML",
  defence_training: "all:%22training+simulation%22+OR+all:%22defence%22+OR+all:%22military+ai%22",
};

interface Paper { title: string; summary: string; url: string; published: string; }

function parseAtom(xml: string): Paper[] {
  const out: Paper[] = [];
  const entries = xml.split(/<entry>/).slice(1);
  for (const e of entries) {
    const title = (/<title>([\s\S]*?)<\/title>/.exec(e)?.[1] ?? "").replace(/\s+/g, " ").trim();
    const summary = (/<summary>([\s\S]*?)<\/summary>/.exec(e)?.[1] ?? "").replace(/\s+/g, " ").trim();
    const url = /<id>([\s\S]*?)<\/id>/.exec(e)?.[1]?.trim() ?? "";
    const published = /<published>([\s\S]*?)<\/published>/.exec(e)?.[1]?.trim() ?? "";
    if (title && url) out.push({ title, summary, url, published });
  }
  return out;
}

async function fetchArxiv(query: string): Promise<Paper[]> {
  const url = `http://export.arxiv.org/api/query?search_query=${query}&sortBy=submittedDate&sortOrder=descending&max_results=8`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const xml = await r.text();
    return parseAtom(xml);
  } catch {
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const inserted: any[] = [];
  const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const cutoff = Date.now() - 4 * 24 * 3600 * 1000;

  for (const [pillar, query] of Object.entries(PILLAR_QUERIES)) {
    const papers = (await fetchArxiv(query))
      .filter((p) => Date.parse(p.published) >= cutoff)
      .slice(0, 3);

    for (const p of papers) {
      const angle = `New paper — ${p.title}. Translate the finding into operator language for CEOs.`;
      const embedding = await embedOne(angle);
      inserted.push({
        title: p.title.slice(0, 220),
        summary: p.summary.slice(0, 700),
        angle,
        counter_take: "Most CEOs will never read this — here's the one thing that matters.",
        source_url: p.url,
        source_type: "arxiv",
        pillar,
        heat_score: 6,
        angle_embedding: embedding,
        expires_at: expiresAt,
      });
    }
  }

  if (inserted.length > 0) {
    const { error } = await supabase.from("trend_radar").insert(inserted);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  await supabase.from("agent_log").insert({
    action: "collect_arxiv",
    api_cost_usd: 0,
    tokens_used: 0,
    details: { inserted: inserted.length },
  });

  return new Response(JSON.stringify({ inserted: inserted.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
