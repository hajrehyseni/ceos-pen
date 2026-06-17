import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sanitizeDraftContent } from "../_shared/content-sanitize.ts";
import { corsHeaders, callClaudeJSON, getSupabase, ok, bad, VOICE_RULES } from "../_shared/visual-asset.ts";

const SYSTEM = `${VOICE_RULES}

Task: read a LinkedIn post or comment that Hajrë might reply to, and produce six reply variants. Each variant must be standalone, 1-4 short lines, no greeting fluff, no "Great post!" openers, no sign-off. British voice.

Variants:
- short: friendly, under 25 words.
- thoughtful: adds a useful observation or framing the original missed.
- witty: gentle British humour, still useful, never punching down.
- disagree: friendly disagreement with one clear reason, no rudeness.
- lead: opens a conversation that could lead to an LRA enquiry, references the AI readiness scorecard at https://build.londonra.com only if it lands naturally (otherwise omit the link).
- dm: an optional DM follow-up to send after they reply.

Return ONLY valid JSON:
{
  "short": "...",
  "thoughtful": "...",
  "witty": "...",
  "disagree": "...",
  "lead": "...",
  "dm": "..."
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { source_text } = await req.json();
    if (!source_text || typeof source_text !== "string" || source_text.length < 5)
      return bad("source_text required (min 5 chars)");
    if (source_text.length > 4000) return bad("source_text too long (max 4000 chars)");
    const key = Deno.env.get("CLAUDE_API_KEY");
    if (!key) return bad("CLAUDE_API_KEY missing", 500);

    const parsed: any = await callClaudeJSON(
      key,
      SYSTEM,
      `Post or comment to reply to:\n"""\n${source_text}\n"""\n\nReturn the JSON now.`,
      1500,
    );

    const clean = (s: string) => sanitizeDraftContent(String(s ?? "")).text;
    const variants = {
      short: clean(parsed.short),
      thoughtful: clean(parsed.thoughtful),
      witty: clean(parsed.witty),
      disagree: clean(parsed.disagree),
      lead: clean(parsed.lead),
      dm: clean(parsed.dm ?? ""),
    };

    const sb = getSupabase();
    const { data, error } = await sb
      .from("reply_drafts")
      .insert({ source_text, variants })
      .select()
      .single();
    if (error) throw error;
    return ok({ status: "ok", draft: data });
  } catch (e: any) {
    return bad(e.message ?? String(e), 500);
  }
});
