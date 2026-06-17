import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sanitizeDraftContent } from "../_shared/content-sanitize.ts";
import { corsHeaders, callClaudeJSON, loadPost, saveAsset, ok, bad, VOICE_RULES } from "../_shared/visual-asset.ts";
import { scoreVisual } from "../_shared/visual-scorer.ts";

const SYSTEM = `${VOICE_RULES}

Task: turn a draft post into a LinkedIn poll.

Return ONLY valid JSON:
{
  "question": "the poll question, max 12 words, plain spoken",
  "options": ["opt1","opt2","opt3","opt4"],
  "caption": "the post text that frames the poll, 3-6 short lines in Hajrë's voice",
  "follow_up_comment": "what to post 24h later when results are in (one short paragraph)",
  "reply_strategy": "one short paragraph on how to reply to voters to start conversations",
  "cta": "optional one-line CTA referencing https://build.londonra.com. Only include if it's a useful next step. Leave empty string if it would feel forced."
}

Each option must be max 30 characters. No leading numbers or punctuation. Cover the realistic spectrum of answers.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { post_id } = await req.json();
    if (!post_id) return bad("post_id required");
    const key = Deno.env.get("CLAUDE_API_KEY");
    if (!key) return bad("CLAUDE_API_KEY missing", 500);

    const post = await loadPost(post_id);
    const user = `Draft post:\n"""\n${post.content}\n"""\n\nReturn the JSON now.`;
    const parsed: any = await callClaudeJSON(key, SYSTEM, user, 1200);
    const clean = (s: string) => sanitizeDraftContent(String(s ?? "")).text;
    parsed.question = clean(parsed.question);
    parsed.caption = clean(parsed.caption);
    parsed.follow_up_comment = clean(parsed.follow_up_comment);
    parsed.reply_strategy = clean(parsed.reply_strategy);
    parsed.cta = clean(parsed.cta ?? "");
    parsed.options = (parsed.options || []).slice(0, 4).map((o: string) => clean(o).slice(0, 30));
    while (parsed.options.length < 4) parsed.options.push("");

    try { parsed.quality = await scoreVisual(key, "poll", parsed, Array.isArray(post.source_material) ? post.source_material : []); } catch (_) {}

    const asset = await saveAsset({ postId: post_id, kind: "poll", payload: parsed });
    return ok({ status: "ok", asset });
  } catch (e: any) {
    return bad(e.message ?? String(e), 500);
  }
});
