import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sanitizeDraftContent } from "../_shared/content-sanitize.ts";
import { corsHeaders, callClaudeJSON, loadPost, saveAsset, ok, bad, VOICE_RULES } from "../_shared/visual-asset.ts";

// Curated meme formats. We do NOT use copyrighted images — the client renders
// a coloured gradient card with big text zones inspired by the format.
const FORMATS = [
  { id: "drake",         label: "Drake (reject / prefer)",   zones: ["reject", "prefer"] },
  { id: "distracted_bf", label: "Distracted boyfriend",      zones: ["glancing_at", "girlfriend", "boyfriend_reaction"] },
  { id: "this_is_fine",  label: "This is fine",              zones: ["situation", "reaction"] },
  { id: "two_buttons",   label: "Two buttons",               zones: ["button_a", "button_b", "who_is_choosing"] },
  { id: "change_my_mind",label: "Change my mind",            zones: ["claim"] },
  { id: "expanding_brain",label:"Expanding brain (tiers)",   zones: ["tier_1", "tier_2", "tier_3", "tier_4"] },
  { id: "top_bottom",    label: "Classic top/bottom",        zones: ["top", "bottom"] },
];

const SYSTEM = `${VOICE_RULES}

Task: turn the draft into ONE meme that a senior operator would actually chuckle at and share. Pick the meme FORMAT whose tension matches the draft — do not force a format that doesn't fit.

Available formats (id — zones you must fill):
${FORMATS.map((f) => `- ${f.id} (${f.label}): ${f.zones.join(", ")}`).join("\n")}

Rules for the captions:
- Short. Meme text lives or dies by punch. Each zone: max 8 words unless the format demands more.
- Voice: British operator wit. Dry, self-aware, slightly cheeky. No American hype, no emojis, no hashtags.
- No fabricated brands, people or numbers. Reference generic patterns ("the AI vendor", "the CEO", "the pilot that never scaled") not made-up companies.
- No slurs, no punching down, no politics.

Return ONLY valid JSON:
{
  "format_id": "one of the ids above",
  "why_this_format": "one sentence — why this format matches the draft's tension",
  "zones": { "<zone_name>": "<caption text>", ... },
  "alt_text": "one sentence describing the meme for accessibility",
  "linkedin_caption": "3-6 short lines to pair with the meme when posting. Hajrë's voice. No URL unless it's the obvious next step.",
  "first_comment": "optional short first comment. Include https://build.londonra.com only if it fits."
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { post_id } = await req.json();
    if (!post_id) return bad("post_id required");
    const key = Deno.env.get("CLAUDE_API_KEY");
    if (!key) return bad("CLAUDE_API_KEY missing", 500);

    const post = await loadPost(post_id);
    const user = `Draft post:\n"""\n${post.content}\n"""\n\nPick the best-fitting meme format and write the captions. Return JSON now.`;
    const parsed: any = await callClaudeJSON(key, SYSTEM, user, 1200);

    const clean = (s: any) => sanitizeDraftContent(String(s ?? "")).text;
    parsed.why_this_format = clean(parsed.why_this_format);
    parsed.alt_text = clean(parsed.alt_text);
    parsed.linkedin_caption = clean(parsed.linkedin_caption);
    parsed.first_comment = clean(parsed.first_comment ?? "");
    const zones: Record<string, string> = {};
    if (parsed.zones && typeof parsed.zones === "object") {
      for (const [k, v] of Object.entries(parsed.zones)) zones[k] = clean(v);
    }
    parsed.zones = zones;

    // Validate format_id fell into our list — fall back to top_bottom.
    if (!FORMATS.some((f) => f.id === parsed.format_id)) parsed.format_id = "top_bottom";

    const asset = await saveAsset({ postId: post_id, kind: "image_post", payload: { ...parsed, meme: true } });
    return ok({ status: "ok", asset });
  } catch (e: any) {
    return bad(e.message ?? String(e), 500);
  }
});
