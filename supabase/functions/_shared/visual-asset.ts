// Shared helpers for visual-asset edge functions (carousel, infographic, image-post, chart, poll, reply).
// Single user, no auth — we just need Claude + a service-role Supabase client.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export const CLAUDE_MODEL = "claude-sonnet-4-5";

export const VOICE_RULES = `You are CEO PEN ghostwriting for Hajrë, founder of London Royal Academy (LRA).
Voice: warm, human, slightly witty British founder. Conversational, clever-but-simple, occasionally cheeky.
Hard rules:
- British English. No em dashes. No emojis. No hashtags. No markdown bold/italics.
- No corporate cliches (leverage, unlock, strategic, ecosystem, transformative, synergy, drive value).
- ZERO FABRICATION: never invent companies, people, numbers, studies, quotes, screenshots or logos.
- If a CTA is appropriate, point to the AI readiness scorecard at https://build.londonra.com naturally.`;

export function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function callClaudeJSON<T = any>(
  apiKey: string,
  system: string,
  user: string,
  maxTokens = 2000,
): Promise<T> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Claude error [${resp.status}]: ${t}`);
  }
  const data = await resp.json();
  let text = (data.content?.[0]?.text ?? "").trim();
  // Strip ```json fences if present.
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  // Try to locate the first { ... } block if Claude added prose.
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1) text = text.slice(first, last + 1);
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new Error(`Failed to parse Claude JSON: ${(e as Error).message}\nRaw: ${text.slice(0, 500)}`);
  }
}

export async function saveAsset(opts: {
  postId: string | null;
  kind: "carousel" | "infographic" | "image_post" | "chart" | "poll" | "reply" | "meme";
  payload: any;
}) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("visual_assets")
    .insert({ post_id: opts.postId, kind: opts.kind, payload: opts.payload, status: "ready" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function ok(body: any) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ status: "error", error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function loadPost(postId: string) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("posts")
    .select("id, content, pillar, source_material, verification_evidence")
    .eq("id", postId)
    .single();
  if (error || !data) throw new Error(`Post not found: ${error?.message ?? "missing"}`);
  return data;
}
