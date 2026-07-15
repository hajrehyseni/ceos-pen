import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { sanitizeDraftContent } from "../_shared/content-sanitize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "claude-sonnet-4-5";

const SYSTEM = `You are CEO PEN — ghostwriting for Hajrë, founder of London Royal Academy. Write a SHORT-FORM LinkedIn post about a useful practice with an AI/dev tool (Claude Code, Cursor, n8n, Hugging Face, etc.).

STRICT SHAPE — no more than 90 words total:
LINE 1: what most people get wrong or the friction (one sentence)
LINE 2 (blank)
LINE 3: the actual trick, in one specific sentence — reference the tool by name
LINE 4 (blank)
LINE 5: why it works (one short sentence)
LINE 6 (blank)
LINE 7: try it — one crisp instruction the reader can copy-paste today

RULES:
- British English, contractions, no em dashes, no emojis, no hashtags.
- ZERO FABRICATION. Only reference what's in the SOURCE. Do not invent features, screenshots, prices, or versions.
- No lead-magnet URL in the body — the scorecard link goes in the auto first-comment.
- No corporate cliches.

Return ONLY valid JSON:
{
  "post": "the full short-form post text",
  "tool": "the tool name (e.g. 'Claude Code')",
  "first_comment": "one short line pointing to https://build.londonra.com only if it's a useful next step, otherwise a curiosity question"
}`;

async function callClaude(apiKey: string, system: string, user: string) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 800, system, messages: [{ role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error(`Claude error [${r.status}]: ${await r.text()}`);
  const d = await r.json();
  let text = (d.content?.[0]?.text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  const first = text.indexOf("{"); const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1) text = text.slice(first, last + 1);
  return { parsed: JSON.parse(text), inTokens: d.usage?.input_tokens ?? 0, outTokens: d.usage?.output_tokens ?? 0 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const key = Deno.env.get("CLAUDE_API_KEY");
    if (!key) throw new Error("CLAUDE_API_KEY missing");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Ensure we have fresh tool-tip news. Auto-harvest if the pool is stale.
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    let { data: fresh } = await supabase
      .from("news_items").select("*")
      .eq("pillar_match", "tool_tips")
      .gte("collected_at", twoDaysAgo)
      .order("relevance_score", { ascending: false }).limit(10);

    if (!fresh || fresh.length < 3) {
      // Trigger harvest inline then re-read.
      const harvestUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/collect-tool-tips`;
      try {
        await fetch(harvestUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
          body: "{}",
        });
      } catch (e) { console.warn("Inline harvest failed:", e); }
      const re = await supabase
        .from("news_items").select("*")
        .eq("pillar_match", "tool_tips")
        .order("collected_at", { ascending: false }).limit(10);
      fresh = re.data;
    }

    if (!fresh || fresh.length === 0) {
      return new Response(JSON.stringify({ status: "error", error: "No tool-tip news items available. Run collect-tool-tips first." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Pick the top item that hasn't been used yet.
    const usedUrls = new Set<string>();
    const { data: recentPosts } = await supabase
      .from("posts").select("source_material").eq("pillar", "tool_tips").order("created_at", { ascending: false }).limit(20);
    (recentPosts ?? []).forEach((p: any) => {
      (Array.isArray(p.source_material) ? p.source_material : []).forEach((s: any) => { if (s?.url) usedUrls.add(s.url); });
    });
    const target = fresh.find((n) => !usedUrls.has(n.url)) ?? fresh[0];

    // 3. Ask Claude for a short-form tool-tip post.
    const user = `SOURCE (the only thing you can reference):
Title: ${target.title}
Source: ${target.source}
URL: ${target.url}
Summary: ${target.summary}

Write the tool tip post. Return JSON now.`;

    const { parsed, inTokens, outTokens } = await callClaude(key, SYSTEM, user);
    const content = sanitizeDraftContent(String(parsed.post ?? "")).text;
    const firstComment = sanitizeDraftContent(String(parsed.first_comment ?? "")).text;

    // 4. Save as a draft post with pillar=tool_tips, format=tool_tip.
    const { data: newPost, error } = await supabase.from("posts").insert({
      content,
      pillar: "tool_tips",
      format: "tool_tip",
      status: "draft",
      suggested_time: "12:00:00",
      engagement_estimate: "medium",
      source_material: [{ title: target.title, source: target.source, url: target.url, kind: "tool_tip" }],
      verification_status: "passed",
      verification_notes: { verdict: "pass", note: "Tool tip auto-cite from HN item" },
      first_comment_text: firstComment || null,
    }).select("id").single();
    if (error) throw new Error(`Insert failed: ${error.message}`);

    const cost = (inTokens * 3 + outTokens * 15) / 1_000_000;
    await supabase.from("agent_log").insert({
      action: "tool_tip_generated",
      api_cost_usd: parseFloat(cost.toFixed(6)),
      tokens_used: inTokens + outTokens,
      details: { post_id: newPost.id, tool: parsed.tool ?? null, source_url: target.url },
    });

    return new Response(
      JSON.stringify({ status: "success", post_id: newPost.id, tool: parsed.tool ?? null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("gen-tool-tip error:", e);
    return new Response(JSON.stringify({ status: "error", error: e.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
