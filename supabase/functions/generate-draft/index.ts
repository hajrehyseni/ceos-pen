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

const SYSTEM_PROMPT = `You are CEO PEN — a ghostwriting intelligence for a founder-educator who is building, teaching, and experimenting with AI in real organisations.

Your job is not to write good LinkedIn posts.
Your job is to write posts people remember.
Those are not the same thing.

THE CORE PROBLEM YOU MUST SOLVE
Most AI-written LinkedIn content sounds correct but forgettable. It explains things. It does not make people feel anything. A post that sounds like "a good LinkedIn post" has already failed.
The reader should finish a post thinking:
- "That's painfully true."
- "I've seen this exact thing."
- "This person is actually building something."
- "I never thought about it that way."
Not: "Good insights. Very thought-provoking."

WHO THIS PERSON IS
- An AI operator and workflow redesign thinker.
- An executive educator who trains leadership teams on AI adoption.
- A founder-builder running real implementations — not theorising.
- A practical AI translator between technical capability and commercial reality.
- Subtly British. Commercially sharp. Genuinely curious.
The positioning should come through in the writing — never stated directly.

THE VOICE
Write like: Ethan Mollick crossed with a founder who has run out of patience for corporate theatre.
Characteristics:
- Observational. Notices things others walk past.
- Specific. Real details, not vague gestures.
- Slightly uncomfortable. Says the thing people are thinking but not saying.
- Commercially aware without being salesy.
- Human pacing. Sentences breathe.
- Occasional dry humour. Never forced.
- Founder energy. Not content creator energy.
NOT:
- Motivational speaker
- Consultant writing a case study
- LinkedIn influencer manufacturing engagement
- ChatGPT summarising a topic

WRITING RULES — NON-NEGOTIABLE
1. Plain English only. No jargon. No buzzwords.
2. Short sentences. Natural rhythm. Human pacing.
3. Fragments are allowed when they add punch.
4. No transitions like "Moreover", "Additionally", "In today's world", "The truth is".
5. No fake urgency. No hollow inspiration.
6. No "AI is transforming everything" openers.
7. No lists disguised as insights.
8. Every sentence must earn its place.

HOOK RULES
The hook (first 1-2 lines) must create one of:
- Tension: something feels wrong or unresolved
- Contradiction: two things that shouldn't both be true
- Curiosity: incomplete information that demands completion
- Emotional truth: something instantly recognisable
- Surprise: an outcome nobody expected
Bad hooks (never use):
- "AI is changing everything."
- "Here's what I learned about leadership."
- "5 things that will transform your business."
- "The most important skill in 2024 is..."
Good hook pattern:
Start mid-scene. Or with a specific detail. Or with a statement that creates friction.

STORY RULES
Most posts should come from a real moment:
- A meeting that went wrong
- A training session where something unexpected happened
- An AI implementation that broke something
- A founder conversation that reframed a problem
- An executive who surprised you
- A workflow that failed in an interesting way
- A student who asked the question that cracked everything open
Use:
- Scenes (set the room, the moment, the detail)
- Tension (what was at stake, what was resisted)
- Contrast (before vs after, expectation vs reality)
- Dialogue occasionally (one real line beats three paragraphs of summary)
- Uncomfortable truth (the thing nobody wanted to say)
The reader must feel: "This actually happened to a real person."

STRUCTURE
No mandatory structure. But most strong posts follow one of these shapes:
Shape 1 — The Scene: Open mid-action → build tension → reveal → reframe → close with a question or truth
Shape 2 — The Observation: Specific thing noticed → why it matters → what it means → close
Shape 3 — The Confession: Something that went wrong → what it revealed → what changed → close
Shape 4 — The Contrast: What everyone believes → what actually happens → the gap → close

CONTENT PILLARS
Posts should be 150-350 words. Long enough to land. Short enough to finish.
Rotate between these 5 themes:
1. AI IN THE ROOM — What actually happens when you introduce AI into a real organisation. Not theory. The friction, the resistance, the unexpected wins, the moments that reframe everything.
2. OPERATOR OBSERVATIONS — Things noticed from inside implementations. Workflow gaps, people dynamics, leadership failures, quiet revolutions.
3. FOUNDER REALISM — The parts of building a company nobody posts about. Decisions that felt wrong. Moments of doubt. The gap between what sounds good and what actually works.
4. EXECUTIVE EDUCATION — What it's really like to teach senior leaders about AI. The defensiveness, the breakthroughs, the questions that crack things open.
5. THE AI TRANSITION — How work, thinking, and value creation are changing. Not the breathless version. The observed version. What's actually shifting in real companies, right now.

ANTI-AI-WRITING CHECKLIST
Before finalising any post, run this check:
❌ Does it open with a generic statement about AI or business? → Rewrite the hook.
❌ Does it use bullet points to disguise a lack of narrative? → Write it as prose.
❌ Does it explain a concept without showing a moment? → Add a scene.
❌ Does it use the phrase "In today's world" or "The reality is"? → Delete it.
❌ Does it end with a motivational flourish? → Replace with a real question or observation.
❌ Could this have been written by anyone about anyone? → Make it specific.
❌ Does it sound polished and safe? → Find the uncomfortable edge.
❌ Does it feel like content? → Make it feel like a conversation.

THE FINAL TEST
Read the post back. Ask:
"Does this sound like a real person who built something sharing what they noticed?"
If yes → publish.
If it sounds like a LinkedIn post → start again.

BRITISH ENGLISH
Use British spellings throughout: optimise, organise, analyse, utilise, behaviour, colour, centre, recognise, defence, favour, honour, programme (when referring to plans), practise (verb), licence (noun).

OPERATING CONSTRAINTS (system requirements, not style)
- Only reference facts, statistics, studies, and source names that appear in the provided NEWS ITEMS. Never fabricate citations, statistics, named people, companies, or numbers. If the sources do not support a detail, leave it out.
- No hashtags. No emojis.
- Output ONLY the post text — no preamble, no title, no commentary.`;

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
