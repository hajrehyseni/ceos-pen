import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sanitizeDraftContent } from "../_shared/content-sanitize.ts";
import { corsHeaders, callClaudeJSON, loadPost, saveAsset, ok, bad, VOICE_RULES } from "../_shared/visual-asset.ts";
import { scoreVisual } from "../_shared/visual-scorer.ts";

const SYSTEM = `${VOICE_RULES}

Task: turn a LinkedIn post into a 6 to 8 slide LinkedIn carousel.
Each slide is read in 2 seconds on a phone. Headline = bold idea (max 8 words). Body = max 22 words. Visual direction = one short sentence describing the visual the designer should build (shapes, layout, metaphor — no fake screenshots, no fake logos, no fake quotes). Icon hint = one or two lucide-react icon names (e.g. "Sparkles", "AlertTriangle").

Slide 1 = hook. Final slide = CTA to https://build.londonra.com phrased like a helpful nudge, not a sales pitch.

Return ONLY valid JSON, no prose:
{
  "title": "short carousel title",
  "slides": [
    { "n": 1, "headline": "...", "body": "...", "visual_direction": "...", "icon_hint": "Sparkles" }
  ],
  "caption": "the LinkedIn caption that goes with the carousel (2-4 short lines, British voice)",
  "sources": ["url", ...]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { post_id } = await req.json();
    if (!post_id) return bad("post_id required");
    const key = Deno.env.get("CLAUDE_API_KEY");
    if (!key) return bad("CLAUDE_API_KEY missing", 500);

    const post = await loadPost(post_id);
    const sources = Array.isArray(post.source_material) ? post.source_material : [];
    const sourceLines = sources.slice(0, 5).map((s: any) => `- ${s.title ?? ""} ${s.url ?? ""}`).join("\n");

    const user = `Original LinkedIn post:\n"""\n${post.content}\n"""\n\nVerified sources (use only facts from here, do not invent):\n${sourceLines || "(none — keep claims conceptual, no numbers)"}\n\nReturn the JSON now.`;
    const parsed: any = await callClaudeJSON(key, SYSTEM, user, 2500);

    // Sanitise every text field.
    const clean = (s: string) => sanitizeDraftContent(String(s ?? "")).text;
    parsed.title = clean(parsed.title);
    parsed.caption = clean(parsed.caption);
    parsed.slides = (parsed.slides || []).map((s: any, i: number) => ({
      n: s.n ?? i + 1,
      headline: clean(s.headline),
      body: clean(s.body),
      visual_direction: clean(s.visual_direction),
      icon_hint: s.icon_hint ?? "Sparkles",
    }));

    const asset = await saveAsset({ postId: post_id, kind: "carousel", payload: parsed });
    return ok({ status: "ok", asset });
  } catch (e: any) {
    return bad(e.message ?? String(e), 500);
  }
});
