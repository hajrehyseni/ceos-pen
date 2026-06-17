import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sanitizeDraftContent } from "../_shared/content-sanitize.ts";
import { corsHeaders, callClaudeJSON, loadPost, saveAsset, ok, bad, VOICE_RULES } from "../_shared/visual-asset.ts";

const SYSTEM = `${VOICE_RULES}

Task: design a single square LinkedIn image post for the given draft.

Return ONLY valid JSON:
{
  "concept": "one sentence describing the visual idea",
  "overlay_text": "max 6 words, the line that sits ON the image",
  "style": "art direction in 1-2 sentences (palette, composition, mood). British editorial. No stock photos of handshakes or arrows.",
  "image_prompt": "a full prompt ready to paste into an AI image tool. Describe subject, composition, colour palette, lighting, style references. Forbidden: fake logos, fake screenshots, fake people likenesses, fake brand names, text other than the overlay_text.",
  "caption": "LinkedIn caption that pairs with the image, 3-6 short lines in Hajrë's voice",
  "first_comment": "first comment with https://build.londonra.com naturally placed",
  "risk_notes": "any things to double-check before posting (e.g. 'avoid likeness of real CEO', 'crop to 1:1')"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { post_id } = await req.json();
    if (!post_id) return bad("post_id required");
    const key = Deno.env.get("CLAUDE_API_KEY");
    if (!key) return bad("CLAUDE_API_KEY missing", 500);

    const post = await loadPost(post_id);
    const user = `Draft post:\n"""\n${post.content}\n"""\n\nReturn the JSON now.`;
    const parsed: any = await callClaudeJSON(key, SYSTEM, user, 1500);
    const clean = (s: string) => sanitizeDraftContent(String(s ?? "")).text;
    parsed.concept = clean(parsed.concept);
    parsed.overlay_text = clean(parsed.overlay_text);
    parsed.style = clean(parsed.style);
    parsed.caption = clean(parsed.caption);
    parsed.first_comment = clean(parsed.first_comment);
    parsed.risk_notes = clean(parsed.risk_notes ?? "");
    // image_prompt is for an external tool — leave as-is.

    const asset = await saveAsset({ postId: post_id, kind: "image_post", payload: parsed });
    return ok({ status: "ok", asset });
  } catch (e: any) {
    return bad(e.message ?? String(e), 500);
  }
});
