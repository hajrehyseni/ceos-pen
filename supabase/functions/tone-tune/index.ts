import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CLAUDE_MODEL = "claude-sonnet-4-5";

// Each tweak is a self-contained directive added on top of a shared system prompt.
const TWEAKS: Record<string, { label: string; directive: string }> = {
  add_british_humour: {
    label: "Add British humour",
    directive: `Add ONE small, warm, British-founder-down-the-pub line of humour. Mild self-awareness, everyday observation, gentle irony or a playful comparison. Must feel natural, never forced. Do not add a second joke. Keep credibility intact.`,
  },
  make_more_fun: {
    label: "Make it more fun",
    directive: `Lift the energy slightly. Looser sentences, a touch more personality, maybe one light witty aside. Still founder-honest, never silly. No emojis, no exclamation marks unless one really earns it.`,
  },
  less_corporate: {
    label: "Make it less corporate",
    directive: `Strip every corporate-sounding word. No "leverage", "unlock", "strategic", "ecosystem", "transformative", "drive value", "synergy". Rewrite in plain, conversational English with contractions. Sound like Hajrë talking, not a deck.`,
  },
  add_natural_lead_magnet: {
    label: "Add natural lead-magnet CTA",
    directive: `End with ONE short, natural line pointing readers to London Royal Academy's AI readiness scorecard at https://build.londonra.com. It must feel like the obvious next step after the insight — never "click here", never desperate, never salesy. One line, in Hajrë's voice. The URL must appear exactly once.`,
  },
  add_softer_lead_magnet: {
    label: "Add softer lead-magnet CTA",
    directive: `Add a soft, almost throwaway mention of the AI readiness scorecard at https://build.londonra.com as a "if this resonates, we built a small thing that helps" style line. Keep it understated. The post must still deliver full value without the link.`,
  },
  less_salesy_cta: {
    label: "Make CTA less salesy",
    directive: `Find any call-to-action or link in the post. Rewrite it to sound less like marketing and more like a helpful aside from a founder. Remove any urgency, hype, or "click here" language. Keep the URL https://build.londonra.com if it was already present; do not add one if it wasn't.`,
  },
  sound_more_like_hajre: {
    label: "Sound more like Hajrë",
    directive: `Rewrite so it reads like Hajrë wrote it on the tube: contractions everywhere, short sentences, the occasional fragment, a dry British observation, first person, no em dashes, no AI-isms. Keep every fact intact — do not invent companies, numbers, or studies.`,
  },
  add_lead_magnet_first_comment: {
    label: "Set lead-magnet as first comment",
    directive: `Do NOT change the post body. Instead, write a single short first-comment line that points to https://build.londonra.com as a helpful next step, in Hajrë's voice. Output the comment text ONLY, wrapped exactly like this: <<<FIRST_COMMENT>>>your comment here<<<END>>>. Do not output anything else.`,
  },
};

async function callClaude(apiKey: string, system: string, user: string, maxTokens = 1200) {
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
  return {
    text: (data.content?.[0]?.text ?? "").trim(),
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

const SYSTEM = `You are CEO PEN — ghostwriting for Hajrë, founder of London Royal Academy. Voice: warm, human, slightly witty British founder. Conversational, clever-but-simple, slightly cheeky when it lands. No corporate cliches, no American hype, no emojis, no hashtags, no em dashes. British English. ZERO FABRICATION — do not invent companies, people, numbers, studies, or dates that weren't in the original post. Output ONLY the rewritten post text unless the directive says otherwise.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { post_id, tweak } = await req.json();
    if (!post_id || !tweak || !TWEAKS[tweak]) {
      return new Response(JSON.stringify({ error: "post_id and a valid tweak are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");
    if (!CLAUDE_API_KEY) throw new Error("CLAUDE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: post, error: postErr } = await supabase
      .from("posts").select("id, content, first_comment_text").eq("id", post_id).single();
    if (postErr || !post) throw new Error(`Post not found: ${postErr?.message ?? "missing"}`);

    const spec = TWEAKS[tweak];
    const userMsg = `ORIGINAL POST:\n"""${post.content}"""\n\nTWEAK:\n${spec.directive}`;
    const r = await callClaude(CLAUDE_API_KEY, SYSTEM, userMsg);

    const updates: Record<string, unknown> = {};
    if (tweak === "add_lead_magnet_first_comment") {
      const m = r.text.match(/<<<FIRST_COMMENT>>>([\s\S]*?)<<<END>>>/);
      const comment = (m?.[1] ?? r.text).trim();
      updates.first_comment_text = comment;
    } else {
      updates.content = r.text.trim();
    }

    const { error: updErr } = await supabase.from("posts").update(updates).eq("id", post_id);
    if (updErr) throw new Error(`Update failed: ${updErr.message}`);

    const cost =
      (r.inputTokens * 3) / 1_000_000 + (r.outputTokens * 15) / 1_000_000;

    await supabase.from("agent_log").insert({
      action: "tone_tune",
      api_cost_usd: parseFloat(cost.toFixed(6)),
      tokens_used: r.inputTokens + r.outputTokens,
      details: { post_id, tweak, label: spec.label },
    });

    return new Response(
      JSON.stringify({ status: "success", tweak, label: spec.label, updates }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("tone-tune error:", e);
    return new Response(JSON.stringify({ status: "error", error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
