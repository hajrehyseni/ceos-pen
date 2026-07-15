import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CLASSIFIER_SYSTEM = `You classify LinkedIn comments left on a founder's post. For each comment, return:
- sentiment: "positive" | "neutral" | "negative" | "critical"
- topic: 3-6 word noun phrase describing what the commenter engaged with
- is_lead_signal: true if the commenter asks about the offer, wants a demo/call, asks how to work with the author, or self-identifies as an ICP (CEO, founder, L&D, defence, academic). Else false.

Output ONLY valid JSON: {"items":[{"idx":<int>,"sentiment":"...","topic":"...","is_lead_signal":false}]}`;

async function classify(
  apiKey: string,
  comments: Array<{ idx: number; text: string; author: string }>,
): Promise<Array<{ idx: number; sentiment: string; topic: string; is_lead_signal: boolean }>> {
  if (comments.length === 0) return [];
  const userMsg = `Comments to classify:\n${comments.map((c) => `${c.idx}. [${c.author}] ${c.text}`).join("\n")}`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 2000,
      system: CLASSIFIER_SYSTEM,
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if (!r.ok) throw new Error(`Claude classify failed [${r.status}]: ${await r.text()}`);
  const j = await r.json();
  const text = j?.content?.[0]?.text ?? "{}";
  const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

async function summariseResonance(
  apiKey: string,
  rows: Array<{ text: string; topic: string; sentiment: string }>,
): Promise<string> {
  if (rows.length === 0) return "";
  const sample = rows.slice(0, 60).map((r) => `- (${r.sentiment}) ${r.topic}: ${r.text.slice(0, 200)}`).join("\n");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 400,
      system: "You summarise what real LinkedIn readers respond to. Return 4-6 short bullets: 3 angles that RESONATE (positive/lead-signal comments) and 2 friction points to AVOID (critical/negative). British English. No preamble.",
      messages: [{ role: "user", content: `Recent classified comments:\n${sample}` }],
    }),
  });
  if (!r.ok) return "";
  const j = await r.json();
  return (j?.content?.[0]?.text ?? "").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const CLAUDE = Deno.env.get("CLAUDE_API_KEY");
    if (!CLAUDE) throw new Error("CLAUDE_API_KEY missing");

    const { data: tokenSetting } = await supabase
      .from("settings").select("value").eq("key", "linkedin_access_token")
      .order("updated_at", { ascending: false }).limit(1).maybeSingle();
    const raw = (tokenSetting?.value ?? "").trim().replace(/^"|"$/g, "");
    const accessToken = raw.startsWith("Bearer ") ? raw.slice(7).trim() : raw;
    if (!accessToken) throw new Error("LinkedIn access token not configured");

    // Last 20 published posts with a known LinkedIn URN
    const { data: posts } = await supabase
      .from("posts").select("id, linkedin_urn, published_at")
      .eq("status", "published").not("linkedin_urn", "is", null)
      .order("published_at", { ascending: false }).limit(20);

    const { data: seen } = await supabase.from("comment_insights").select("comment_urn");
    const seenSet = new Set((seen ?? []).map((s: any) => s.comment_urn));

    let fetched = 0, inserted = 0, failed = 0;
    const classificationPayload: Array<{ post_id: string; urn: string; author: string; text: string }> = [];

    for (const p of posts ?? []) {
      const urn = p.linkedin_urn as string;
      const url = `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(urn)}/comments?count=50`;
      const r = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      });
      if (!r.ok) {
        console.error("comments fetch failed", urn, r.status, await r.text().catch(() => ""));
        failed++;
        continue;
      }
      const j = await r.json();
      const elements: any[] = Array.isArray(j?.elements) ? j.elements : [];
      for (const el of elements) {
        const commentUrn = el?.["$URN"] ?? el?.id ?? null;
        const text = el?.message?.text ?? "";
        if (!commentUrn || !text || seenSet.has(commentUrn)) continue;
        const author = el?.actor ?? "unknown";
        classificationPayload.push({ post_id: p.id, urn: commentUrn, author, text });
        fetched++;
      }
    }

    // Classify in batches of 15
    for (let i = 0; i < classificationPayload.length; i += 15) {
      const batch = classificationPayload.slice(i, i + 15).map((c, idx) => ({
        idx, text: c.text, author: c.author,
      }));
      const results = await classify(CLAUDE, batch);
      const byIdx = new Map(results.map((r) => [r.idx, r]));
      const rows = classificationPayload.slice(i, i + 15).map((c, idx) => {
        const cls = byIdx.get(idx) ?? { sentiment: "neutral", topic: "unclassified", is_lead_signal: false };
        return {
          post_id: c.post_id,
          comment_urn: c.urn,
          author_name: c.author,
          text: c.text,
          sentiment: cls.sentiment,
          topic: cls.topic,
          is_lead_signal: !!cls.is_lead_signal,
        };
      });
      const { error } = await supabase.from("comment_insights").upsert(rows, { onConflict: "comment_urn" });
      if (!error) inserted += rows.length;
    }

    // Refresh resonance summary from last 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400_000).toISOString();
    const { data: recent } = await supabase
      .from("comment_insights").select("text, topic, sentiment")
      .gte("created_at", ninetyDaysAgo).limit(200);
    const summary = await summariseResonance(CLAUDE, recent ?? []);
    if (summary) {
      await supabase.from("settings").upsert(
        { key: "resonance_summary", value: summary, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    }

    await supabase.from("agent_log").insert({
      action: "comments_mined",
      api_cost_usd: 0,
      tokens_used: 0,
      details: { posts_checked: posts?.length ?? 0, fetched, inserted, failed, summary_len: summary.length },
    });

    return new Response(
      JSON.stringify({ status: "success", posts_checked: posts?.length ?? 0, fetched, inserted, failed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("mine-comments error:", e);
    return new Response(
      JSON.stringify({ status: "error", error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
