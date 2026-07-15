// Turn a published LinkedIn post into channel-native variants
// for X (thread), Threads (single), and Bluesky (single).
// Stored in public.channel_variants; UI/user handles the actual posting.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLAUDE_MODEL = "claude-sonnet-4-5";

const SYSTEM = `You repurpose a LinkedIn post by Hajrë Hyseni (London Royal Academy — AI + exec training) into channel-native variants.
Voice: British, dry, warm, operator-CEO. No hashtags, no emojis, no corporate cliches. Never fabricate — only use facts from the source post.

Produce THREE variants:
- x: a Twitter/X thread of 3-6 tweets. Each tweet <= 275 chars. Join with a single "\\n---\\n" separator. First tweet is the hook. Last tweet ends with the scorecard/lead-magnet URL if one appears in the source.
- threads: ONE Threads post, <= 480 chars. Punchier than LinkedIn — cut throat-clearing.
- bluesky: ONE Bluesky post, <= 290 chars. Sharp, opinion-forward.

Return ONLY JSON: { "x": "...", "threads": "...", "bluesky": "..." }`;

async function callClaude(apiKey: string, user: string) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CLAUDE_MODEL, max_tokens: 1800, system: SYSTEM,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!r.ok) throw new Error(`Claude [${r.status}]: ${await r.text()}`);
  const data = await r.json();
  const text = (data.content?.[0]?.text ?? "").trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
  return { parsed: JSON.parse(text), usage: data.usage };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const claudeKey = Deno.env.get("CLAUDE_API_KEY");
  if (!claudeKey) {
    return new Response(JSON.stringify({ error: "Missing CLAUDE_API_KEY" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* ok */ }
  const explicitId: string | undefined = body.post_id;

  // Pick target posts: explicit one, or published posts in the last 24h missing variants.
  let posts: any[] = [];
  if (explicitId) {
    const { data } = await supabase
      .from("posts")
      .select("id, content, pillar, verification_status, engagement_estimate")
      .eq("id", explicitId).limit(1);
    posts = data ?? [];
  } else {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("posts")
      .select("id, content, pillar, verification_status, engagement_estimate, channel_variants(id)")
      .eq("status", "published")
      .gte("published_at", since)
      .limit(10);
    posts = (data ?? []).filter((p: any) => !p.channel_variants?.length);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  let totalCost = 0;
  const results: any[] = [];

  for (const p of posts) {
    try {
      const { parsed, usage } = await callClaude(claudeKey, `SOURCE POST:\n${p.content}`);
      totalCost += ((usage?.input_tokens ?? 0) * 3 + (usage?.output_tokens ?? 0) * 15) / 1_000_000;

      // Auto-approve variants only when the source post cleared the same gate as auto-publish.
      const autoApprove = p.verification_status === "passed" && p.engagement_estimate === "high";
      const initialStatus = autoApprove ? "approved" : "draft";

      const rows = (["x", "threads", "bluesky"] as const)
        .filter((c) => typeof parsed[c] === "string" && parsed[c].length > 0)
        .map((c) => ({
          post_id: p.id,
          channel: c,
          variant_text: String(parsed[c]).slice(0, 4000),
          char_count: String(parsed[c]).length,
          status: initialStatus,
        }));
      if (rows.length) {
        await supabase.from("channel_variants").upsert(rows, { onConflict: "post_id,channel" });
      }

      // Fire-and-forget the three publishers when variants are auto-approved.
      if (autoApprove && rows.length) {
        for (const fn of ["publish-x", "publish-bluesky", "publish-threads"]) {
          fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: ANON },
            body: JSON.stringify({ trigger: "auto", post_id: p.id }),
          }).catch((e) => console.error(`${fn} kick failed:`, e));
        }
      }

      results.push({ post_id: p.id, variants: rows.length, auto_approved: autoApprove });
    } catch (e) {
      console.error(`repurpose ${p.id} failed:`, e);
      results.push({ post_id: p.id, error: String(e) });
    }
  }


  await supabase.from("agent_log").insert({
    action: "repurpose_channels",
    api_cost_usd: Number(totalCost.toFixed(6)),
    tokens_used: 0,
    details: { count: posts.length, results },
  });

  return new Response(JSON.stringify({ processed: posts.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
