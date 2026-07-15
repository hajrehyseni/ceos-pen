// Pulls hot/rising posts from a set of subreddits relevant to Hajrë's
// pillars. Reddit's public JSON endpoint is used (no auth needed).
// Each interesting post becomes a row in trend_radar with source_type='reddit'.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { embedOne } from "../_shared/embeddings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PILLAR_SUBREDDITS: Record<string, string[]> = {
  ai_agents: ["LocalLLaMA", "AI_Agents", "singularity", "LangChain", "MachineLearning"],
  defence_training: ["Military", "CredibleDefense", "LessCredibleDefence"],
  academic_research: ["MachineLearning", "artificial", "compsci"],
  ceo_journey: ["startups", "Entrepreneur", "SaaS", "ycombinator"],
  curated_commentary: ["technology", "Futurology", "artificial"],
};

interface RedditPost {
  title: string;
  url: string;
  permalink: string;
  score: number;
  num_comments: number;
  selftext: string;
  subreddit: string;
  created_utc: number;
}

async function fetchSubredditHot(sub: string): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${sub}/hot.json?limit=15&t=day`;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "ceo-pen-bot/1.0 (LinkedIn ghostwriter research)" },
    });
    if (!r.ok) return [];
    const data = await r.json();
    return (data.data?.children ?? [])
      .map((c: any) => c.data)
      .filter((p: RedditPost) => p && !p.title?.includes("[Meta]"));
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
  const now = Date.now();
  const expiresAt = new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString();

  for (const [pillar, subs] of Object.entries(PILLAR_SUBREDDITS)) {
    const bucket: RedditPost[] = [];
    for (const sub of subs) {
      const posts = await fetchSubredditHot(sub);
      bucket.push(...posts);
      await new Promise((r) => setTimeout(r, 400)); // be polite to Reddit
    }

    // Take top 3 by engagement (score + 2*comments) newer than 3 days.
    const cutoff = now / 1000 - 3 * 24 * 3600;
    const top = bucket
      .filter((p) => p.created_utc >= cutoff && p.score > 30)
      .sort((a, b) => (b.score + 2 * b.num_comments) - (a.score + 2 * a.num_comments))
      .slice(0, 3);

    for (const p of top) {
      const heat = Math.min(10, Math.round(Math.log2((p.score + 2 * p.num_comments) / 30 + 1) + 4));
      const angle = `Reddit r/${p.subreddit} chatter: ${p.title}`;
      const embedding = await embedOne(angle);
      const row = {
        title: p.title.slice(0, 220),
        summary: (p.selftext || p.title).slice(0, 600),
        angle,
        counter_take: "What would an operator-CEO say to this crowd?",
        source_url: `https://reddit.com${p.permalink}`,
        source_type: "reddit",
        pillar,
        heat_score: heat,
        angle_embedding: embedding,
        expires_at: expiresAt,
      };
      inserted.push(row);
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
    action: "collect_reddit",
    api_cost_usd: 0,
    tokens_used: 0,
    details: { inserted: inserted.length },
  });

  return new Response(JSON.stringify({ inserted: inserted.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
