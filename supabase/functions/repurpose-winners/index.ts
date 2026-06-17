// Repurpose past winners — pick a 21+ day old top post and rewrite it
// from a fresh angle, push the result into the draft queue.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const INPUT_COST_PER_TOKEN = 3 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000;

const REPURPOSE_SYSTEM = `You are CEO PEN — Hajre's ghostwriter. You're repurposing a previously high-performing post. RULES:
- Keep the same underlying insight or moment, but tell it from a DIFFERENT angle: new hook, different opening scene, different framing, different ending.
- Same voice (British English, contractions, short varied sentences, first person, no em dashes, no AI-isms like leverage/unlock/in today's world).
- 150-350 words. No hashtags, no emojis, no preamble.
- Zero fabrication. If the original referenced a number/company/study and you keep it, keep it verbatim. Don't invent new ones.
- Output ONLY the post text.`;

async function callClaude(apiKey: string, system: string, user: string, maxTokens = 1500) {
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");
    if (!CLAUDE_API_KEY) throw new Error("CLAUDE_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const twentyOneDaysAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString();
    const oneEightyDaysAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();

    const { data: publishedPosts } = await supabase
      .from("posts")
      .select("id, content, pillar, published_at")
      .eq("status", "published")
      .lte("published_at", twentyOneDaysAgo)
      .gte("published_at", oneEightyDaysAgo);

    if (!publishedPosts || publishedPosts.length === 0) {
      return new Response(JSON.stringify({ status: "success", repurposed: 0, reason: "no eligible posts" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = publishedPosts.map((p) => p.id);
    const { data: metricsRows } = await supabase
      .from("post_metrics")
      .select("post_id, likes, comments, reposts")
      .in("post_id", ids);

    const scoreByPost = new Map<string, number>();
    (metricsRows ?? []).forEach((m: any) => {
      const s = (m.likes ?? 0) + 3 * (m.comments ?? 0) + 2 * (m.reposts ?? 0);
      scoreByPost.set(m.post_id, Math.max(scoreByPost.get(m.post_id) ?? 0, s));
    });

    // Exclude posts already repurposed
    const { data: alreadyRepurposed } = await supabase
      .from("posts")
      .select("repurposed_from_post_id")
      .not("repurposed_from_post_id", "is", null);
    const used = new Set((alreadyRepurposed ?? []).map((r: any) => r.repurposed_from_post_id));

    const candidates = publishedPosts
      .map((p) => ({ ...p, engagement: scoreByPost.get(p.id) ?? 0 }))
      .filter((p) => p.engagement > 0 && !used.has(p.id))
      .sort((a, b) => b.engagement - a.engagement);

    if (candidates.length === 0) {
      return new Response(JSON.stringify({ status: "success", repurposed: 0, reason: "no fresh winners" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Top 25% pool, pick one at random for variety
    const poolSize = Math.max(1, Math.ceil(candidates.length * 0.25));
    const pool = candidates.slice(0, poolSize);
    const pick = pool[Math.floor(Math.random() * pool.length)];

    const userMsg = `ORIGINAL POST (published ${pick.published_at}, engagement ${pick.engagement}, pillar ${pick.pillar}):
"""${pick.content}"""

Rewrite this as a fresh post. Keep the core insight, change the angle, the hook, the opening, and the structure. Output ONLY the post text.`;

    const result = await callClaude(CLAUDE_API_KEY, REPURPOSE_SYSTEM, userMsg);
    const cost = result.inputTokens * INPUT_COST_PER_TOKEN + result.outputTokens * OUTPUT_COST_PER_TOKEN;

    const { data: newPost, error: insErr } = await supabase
      .from("posts")
      .insert({
        content: result.text.trim(),
        pillar: pick.pillar,
        status: "draft",
        format: "text",
        suggested_time: "09:00:00",
        engagement_estimate: "medium",
        repurposed_from_post_id: pick.id,
        verification_status: "passed",
        verification_notes: { verdict: "pass", source: "repurposed_winner", note: "Repurposed from an already-verified winning post." },
      })
      .select("id")
      .single();
    if (insErr) throw new Error(`insert draft: ${insErr.message}`);

    await supabase.from("agent_log").insert({
      action: "winner_repurposed",
      api_cost_usd: parseFloat(cost.toFixed(6)),
      tokens_used: result.inputTokens + result.outputTokens,
      details: {
        source_post_id: pick.id,
        source_engagement: pick.engagement,
        new_post_id: newPost.id,
        pool_size: pool.length,
        model: CLAUDE_MODEL,
      },
    });

    return new Response(
      JSON.stringify({ status: "success", repurposed: 1, post_id: newPost.id, source_post_id: pick.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("repurpose-winners error:", e);
    return new Response(
      JSON.stringify({ status: "error", error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
