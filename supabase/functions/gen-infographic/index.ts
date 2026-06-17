import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sanitizeDraftContent } from "../_shared/content-sanitize.ts";
import { corsHeaders, callClaudeJSON, loadPost, saveAsset, ok, bad, VOICE_RULES } from "../_shared/visual-asset.ts";

const SYSTEM = `${VOICE_RULES}

Task: design a single vertical mobile-friendly LinkedIn infographic distilled from a post.
3 to 5 visual blocks. Each block: a one or two word label, a short value/number IF AND ONLY IF the source material contains it (else leave value empty), a one-sentence note (max 14 words), and one lucide-react icon name.

Title: max 7 words. Caption: 2-3 short lines including a natural mention of https://build.londonra.com if it fits.

NEVER invent statistics. If no numerical claim is in the source, the block "value" must be an empty string and the note must be qualitative.

Return ONLY valid JSON:
{
  "title": "...",
  "subtitle": "one short supporting line, optional",
  "blocks": [ { "label": "...", "value": "", "note": "...", "icon": "Sparkles" } ],
  "caption": "...",
  "sources": [ { "title": "...", "url": "..." } ]
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
    const sourceLines = sources.slice(0, 6).map((s: any) => `- ${s.title ?? ""} :: ${s.url ?? ""} :: ${s.snippet ?? s.summary ?? ""}`).join("\n");

    const user = `Original LinkedIn post:\n"""\n${post.content}\n"""\n\nVerified sources:\n${sourceLines || "(none)"}\n\nReturn the JSON now.`;
    const parsed: any = await callClaudeJSON(key, SYSTEM, user, 1800);
    const clean = (s: string) => sanitizeDraftContent(String(s ?? "")).text;
    parsed.title = clean(parsed.title);
    parsed.subtitle = clean(parsed.subtitle ?? "");
    parsed.caption = clean(parsed.caption);
    parsed.blocks = (parsed.blocks || []).map((b: any) => ({
      label: clean(b.label),
      value: clean(b.value ?? ""),
      note: clean(b.note),
      icon: b.icon ?? "Sparkles",
    }));
    parsed.sources = parsed.sources || sources.slice(0, 4).map((s: any) => ({ title: s.title, url: s.url }));

    const asset = await saveAsset({ postId: post_id, kind: "infographic", payload: parsed });
    return ok({ status: "ok", asset });
  } catch (e: any) {
    return bad(e.message ?? String(e), 500);
  }
});
