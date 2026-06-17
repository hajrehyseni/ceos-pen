import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sanitizeDraftContent } from "../_shared/content-sanitize.ts";
import { corsHeaders, callClaudeJSON, loadPost, saveAsset, ok, bad, VOICE_RULES } from "../_shared/visual-asset.ts";

const SYSTEM = `${VOICE_RULES}

Task: extract chart-ready numeric data from a post and its verified sources.

ABSOLUTE RULE: only use numbers that appear verbatim in the user-provided text or sources. If the post contains qualitative claims but no concrete numbers, you MUST return { "insufficient_data": true, "reason": "..." } and nothing else. Do not estimate, infer, or round.

If numbers exist:
{
  "type": "bar" | "line" | "comparison" | "ranking",
  "title": "short chart title",
  "unit": "% / users / £m / etc.",
  "data": [ { "label": "...", "value": 12, "series": "optional series name" } ],
  "caption": "one-sentence takeaway in Hajrë's voice",
  "sources": [ { "title": "...", "url": "..." } ]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { post_id, user_data } = await req.json();
    if (!post_id) return bad("post_id required");
    const key = Deno.env.get("CLAUDE_API_KEY");
    if (!key) return bad("CLAUDE_API_KEY missing", 500);

    const post = await loadPost(post_id);
    const sources = Array.isArray(post.source_material) ? post.source_material : [];
    const sourceLines = sources.slice(0, 6).map((s: any) => `- ${s.title ?? ""} :: ${s.url ?? ""} :: ${s.snippet ?? s.summary ?? ""}`).join("\n");

    const user = `Post:\n"""\n${post.content}\n"""\n\nVerified sources:\n${sourceLines || "(none)"}\n\n${user_data ? `User-pasted data:\n"""\n${user_data}\n"""\n\n` : ""}Return the JSON now.`;
    const parsed: any = await callClaudeJSON(key, SYSTEM, user, 1500);

    if (parsed.insufficient_data) {
      const asset = await saveAsset({ postId: post_id, kind: "chart", payload: parsed });
      return ok({ status: "ok", asset });
    }

    const clean = (s: string) => sanitizeDraftContent(String(s ?? "")).text;
    parsed.title = clean(parsed.title);
    parsed.caption = clean(parsed.caption ?? "");
    parsed.data = (parsed.data || []).map((d: any) => ({
      label: clean(d.label),
      value: Number(d.value),
      series: d.series ? clean(d.series) : undefined,
    })).filter((d: any) => Number.isFinite(d.value));

    if (parsed.data.length === 0) {
      parsed.insufficient_data = true;
      parsed.reason = "No numeric values survived validation.";
    }

    const asset = await saveAsset({ postId: post_id, kind: "chart", payload: parsed });
    return ok({ status: "ok", asset });
  } catch (e: any) {
    return bad(e.message ?? String(e), 500);
  }
});
