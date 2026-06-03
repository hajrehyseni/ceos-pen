import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAY_PILLARS: Record<number, string> = {
  0: "ceo_journey", // Sunday
  1: "ai_agents", // Monday
  2: "defence_training", // Tuesday
  3: "academic_research", // Wednesday
  4: "ceo_journey", // Thursday
  5: "curated_commentary", // Friday
  6: "curated_commentary", // Saturday
};

const PILLAR_LABELS: Record<string, string> = {
  ai_agents: "AI Agents",
  defence_training: "Defence Training",
  academic_research: "Academic Research",
  ceo_journey: "CEO Journey",
  curated_commentary: "Curated Commentary",
};

const DAY_SUGGESTED_TIMES: Record<number, string> = {
  0: "11:00:00", // Sunday
  1: "08:45:00", // Monday
  2: "08:30:00", // Tuesday
  3: "08:45:00", // Wednesday
  4: "09:00:00", // Thursday
  5: "10:00:00", // Friday
  6: "10:30:00", // Saturday
};

const SYSTEM_PROMPT = `You are CEO PEN — a ghostwriting agent for a founder-educator who builds AI workflows. Write posts people REMEMBER, not just good LinkedIn posts. Voice: observational, specific, human pacing, subtle British humour, founder energy — like Ethan Mollick crossed with a tired-of-corporate-theatre operator. RULES: plain English, short sentences, fragments OK, no transitions like Moreover/Additionally/In today's world, no AI-transforming-everything openers, no lists-as-insights, every sentence earns its place. HOOKS must create: tension, contradiction, curiosity, emotional truth, or surprise. Never: AI is changing everything / Here's what I learned / 5 things / most important skill in 2024. STORIES come from: real meetings gone wrong, training sessions, AI implementations that broke, founder conversations, workflow failures, executive surprises. Use scenes, tension, contrast, occasional dialogue, uncomfortable truths. STRUCTURE: 150-350 words. Four shapes — Scene, Observation, Confession, Contrast. PILLARS: AI IN THE ROOM, OPERATOR OBSERVATIONS, FOUNDER REALISM, EXECUTIVE EDUCATION, THE AI TRANSITION. ANTI-AI CHECKLIST: no generic openers, no bullet-point narratives, no concept-without-moment, no In today's world, no motivational endings, nothing anyone could write, nothing polished-and-safe, nothing content-feeling. FINAL TEST: sounds like a real person building through the AI transition in public? Yes = publish. Sounds like a LinkedIn post = rewrite. BRITISH ENGLISH: optimise, organise, analyse, behaviour, colour, centre, recognise.

OPERATING CONSTRAINTS (system requirements, not style)
- Only reference facts, statistics, studies, and source names that appear in the provided NEWS ITEMS. Never fabricate citations, statistics, named people, companies, or numbers. If the sources do not support a detail, leave it out.
- No hashtags. No emojis.
- Output ONLY the post text — no preamble, no title, no commentary.
- You may reference the CURRENT AI LANDSCAPE items to make the post feel timely, but only if it fits the pillar naturally. Never force it. Still no fabrication — only facts from the provided items.`;

// Claude pricing: sonnet input $3/MTok, output $15/MTok
const INPUT_COST_PER_TOKEN = 3 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Check day of week and determine pillar
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat

    // 2. Determine pillar
    const pillar = DAY_PILLARS[dayOfWeek];
    if (!pillar) throw new Error(`No content pillar configured for day ${dayOfWeek}`);
    const pillarLabel = PILLAR_LABELS[pillar];

    const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");
    if (!CLAUDE_API_KEY) throw new Error("CLAUDE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3. Fetch news_items from last 24h
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: newsItems } = await supabase
      .from("news_items")
      .select("*")
      .gte("collected_at", yesterday)
      .order("relevance_score", { ascending: false })
      .limit(15);

    // 4. Fetch top 3 voice_samples
    const { data: voiceSamples } = await supabase
      .from("voice_samples")
      .select("*")
      .order("performance_rating", { ascending: false })
      .limit(3);

    // 5. Fetch last 3 rejected posts
    const { data: rejectedPosts } = await supabase
      .from("posts")
      .select("content, rejection_reason")
      .not("rejection_reason", "is", null)
      .order("rejected_at", { ascending: false })
      .limit(3);

    // Build user message
    const todayStr = now.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const newsSection =
      newsItems && newsItems.length > 0
        ? newsItems
            .map((n, i) => `${i + 1}. ${n.title} (${n.source}) — ${n.url}\n   ${n.summary}`)
            .join("\n")
        : "No recent news items available.";

    const voiceSection =
      voiceSamples && voiceSamples.length > 0
        ? voiceSamples.map((v) => `- "${v.content}"`).join("\n")
        : "No voice samples available.";

    const rejectSection =
      rejectedPosts && rejectedPosts.length > 0
        ? rejectedPosts
            .map((r) => `- Reason: ${r.rejection_reason}\n  Post excerpt: ${r.content?.slice(0, 150)}...`)
            .join("\n")
        : "No previous rejections.";

    const userMessage = `Today is ${todayStr}. The content pillar for today is: ${pillarLabel}.

NEWS ITEMS (use as source material):
${newsSection}

VOICE SAMPLES (match this tone and style):
${voiceSection}

PREVIOUSLY REJECTED (avoid these patterns):
${rejectSection}

Write a LinkedIn post for the ${pillarLabel} pillar.`;

    // 6. Call Claude API
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error("Claude API error:", claudeResponse.status, errText);
      throw new Error(`Claude API error [${claudeResponse.status}]: ${errText}`);
    }

    const claudeData = await claudeResponse.json();
    let postContent: string =
      claudeData.content?.[0]?.text ?? "";

    const inputTokens = claudeData.usage?.input_tokens ?? 0;
    const outputTokens = claudeData.usage?.output_tokens ?? 0;
    const totalTokens = inputTokens + outputTokens;
    const apiCost =
      inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN;

    // 7. Tidy whitespace. CEO PEN v2 defines its own endings (a real question
    //    or truth) and the project bans emojis, so no forced "Ta-ta 🙃" sign-off.
    postContent = postContent.trim();

    // 8. Insert into posts
    const sourceMaterial = (newsItems ?? []).map((n) => ({
      id: n.id,
      title: n.title,
      source: n.source,
      url: n.url,
      relevance_score: n.relevance_score,
    }));

    const { data: newPost, error: postError } = await supabase
      .from("posts")
      .insert({
        content: postContent,
        pillar,
        status: "draft",
        format: "text",
         suggested_time: DAY_SUGGESTED_TIMES[dayOfWeek] ?? "09:00:00",
        engagement_estimate: "medium",
        source_material: sourceMaterial,
      })
      .select("id")
      .single();

    if (postError) throw new Error(`Insert post failed: ${postError.message}`);

    // 9. Log to agent_log
    await supabase.from("agent_log").insert({
      action: "draft_generated",
      api_cost_usd: parseFloat(apiCost.toFixed(6)),
      tokens_used: totalTokens,
      details: {
        pillar,
        model: "claude-sonnet-4-20250514",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        post_id: newPost.id,
        news_items_count: newsItems?.length ?? 0,
      },
    });

    // 10. Return JSON
    return new Response(
      JSON.stringify({
        status: "success",
        post_id: newPost.id,
        cost: parseFloat(apiCost.toFixed(6)),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-draft error:", e);
    return new Response(
      JSON.stringify({ status: "error", error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
