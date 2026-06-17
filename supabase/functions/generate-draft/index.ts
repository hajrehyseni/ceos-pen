import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAY_PILLARS: Record<number, string> = {
  0: "ceo_journey",
  1: "ai_agents",
  2: "defence_training",
  3: "academic_research",
  4: "ceo_journey",
  5: "curated_commentary",
  6: "curated_commentary",
};

const PILLAR_LABELS: Record<string, string> = {
  ai_agents: "AI Agents",
  defence_training: "Defence Training",
  academic_research: "Academic Research",
  ceo_journey: "CEO Journey",
  curated_commentary: "Curated Commentary",
};

const DAY_SUGGESTED_TIMES: Record<number, string> = {
  0: "11:00:00",
  1: "08:45:00",
  2: "08:30:00",
  3: "08:45:00",
  4: "09:00:00",
  5: "10:00:00",
  6: "10:30:00",
};

const SYSTEM_PROMPT = `You are CEO PEN — a ghostwriting agent for a founder-educator who builds AI workflows. Write posts people REMEMBER, not just good LinkedIn posts. Voice: observational, specific, human pacing, subtle British humour, founder energy — like Ethan Mollick crossed with a tired-of-corporate-theatre operator. RULES: plain English, short sentences, fragments OK, no transitions like Moreover/Additionally/In today's world, no AI-transforming-everything openers, no lists-as-insights, every sentence earns its place. HOOKS must create: tension, contradiction, curiosity, emotional truth, or surprise. Never: AI is changing everything / Here's what I learned / 5 things / most important skill in 2024. STORIES come from: real meetings gone wrong, training sessions, AI implementations that broke, founder conversations, workflow failures, executive surprises. Use scenes, tension, contrast, occasional dialogue, uncomfortable truths. STRUCTURE: 150-350 words. Four shapes — Scene, Observation, Confession, Contrast. PILLARS: AI IN THE ROOM, OPERATOR OBSERVATIONS, FOUNDER REALISM, EXECUTIVE EDUCATION, THE AI TRANSITION. ANTI-AI CHECKLIST: no generic openers, no bullet-point narratives, no concept-without-moment, no In today's world, no motivational endings, nothing anyone could write, nothing polished-and-safe, nothing content-feeling. FINAL TEST: sounds like a real person building through the AI transition in public? Yes = publish. Sounds like a LinkedIn post = rewrite. BRITISH ENGLISH: optimise, organise, analyse, behaviour, colour, centre, recognise.

OPERATING CONSTRAINTS (system requirements, not style)
- ZERO FABRICATION. Never invent company names, people, products, institutions, statistics, percentages, dates, dollar/pound amounts, study names, or research citations. Every named entity, number, and study reference must come directly from the supplied NEWS ITEMS or CURRENT AI LANDSCAPE. If the sources don't support a specific fact, omit it — describe the pattern in your own words instead.
- Personal anecdotes, scenes, opinions, and the author's own observations are encouraged and don't need a source — they're first-person voice, not external claims.
- USEFULNESS BAR. Every post must clear all three:
  1. Contain at least one concrete, actionable takeaway, framework, or lesson the reader can use.
  2. Challenge a common assumption OR be anchored on a specific number/named example from the sources.
  3. No vague thought-leader fluff. If a sentence could appear on any LinkedIn post, cut it.
- No hashtags. No emojis.
- Output ONLY the post text — no preamble, no title, no commentary.
- You may reference the CURRENT AI LANDSCAPE items to make the post feel timely, but only if it fits the pillar naturally. Never force it.`;

const HOOK_BRAINSTORM_PROMPT = `You generate LinkedIn HOOKS only — the first 1-2 lines of a post. Return exactly 3 hook options, each using a DIFFERENT shape:
1. TENSION — two things that shouldn't co-exist, do.
2. CONFESSION — admit something most people in your position won't.
3. SCENE — a specific moment, dialogue, or sensory detail.

Each hook: 1-2 sentences, max 30 words, no emoji, no hashtags, British English. Grounded in the supplied news items where possible (no fabrication).

Return ONLY valid JSON, no markdown:
{
  "hooks": [
    { "shape": "tension"|"confession"|"scene", "text": "..." }
  ]
}`;

const VERIFIER_SYSTEM_PROMPT = `You are a strict fact-checker. You receive a LinkedIn draft and a list of SOURCE ITEMS (titles, sources, summaries). Your job: identify every factual claim in the draft that references either (a) a named company, person, product, institution, university or government body, (b) a specific number, statistic, percentage, date, or monetary amount, or (c) a named study, report, or research finding. For each claim, decide whether it is directly supported by at least one source item.

EXEMPT (do NOT flag): the author's personal anecdotes, scenes from their own meetings/work, opinions, predictions, observations, generalities ("AI is being adopted"), and rhetorical questions. These are first-person voice, not external factual claims.

Return ONLY valid JSON, no markdown, in this exact shape:
{
  "verdict": "pass" | "fail",
  "claims": [
    { "claim": "<exact phrase from draft>", "type": "entity"|"number"|"study", "supported": true|false, "source_index": <1-based index into sources, or null>, "reason": "<one short sentence>" }
  ]
}

Verdict is "pass" only if every claim has supported=true. Otherwise "fail".`;

const SCORER_SYSTEM_PROMPT = `You score LinkedIn posts for VIRALITY and USEFULNESS. Be harsh — a 7 means genuinely strong, a 9 means a top 1% post.

Rate each axis 0-10:
- hook_strength: does the first 1-2 lines force the reader to keep reading?
- specificity: concrete entities, numbers, named examples, real moments — not generic.
- emotional_pull: does it create tension, surprise, recognition, or discomfort?
- shareability: would a thoughtful operator quote-share this with a comment?

Then assess usefulness booleans:
- actionable_takeaway: reader walks away with something they could DO or USE.
- contrarian_angle: challenges a common assumption or reframes the obvious.
- data_or_example_led: anchored on a specific stat or named case, not vibes.

overall = weighted average: 0.35*hook + 0.20*specificity + 0.20*emotional + 0.25*shareability.

fixes: array of 1-4 SHORT, SPECIFIC rewrites the author should make. Empty if overall >= 8.

Return ONLY valid JSON, no markdown:
{
  "hook_strength": 0-10,
  "specificity": 0-10,
  "emotional_pull": 0-10,
  "shareability": 0-10,
  "usefulness": { "actionable_takeaway": bool, "contrarian_angle": bool, "data_or_example_led": bool },
  "overall": 0-10,
  "fixes": ["...", "..."]
}`;

const CLAUDE_GENERATION_MODEL = "claude-sonnet-4-20250514";
const CLAUDE_VERIFIER_MODEL = "claude-sonnet-4-20250514";

// Claude pricing
const INPUT_COST_PER_TOKEN = 3 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000;

type VerifierClaim = {
  claim: string;
  type: "entity" | "number" | "study";
  supported: boolean;
  source_index: number | null;
  reason: string;
};

type VerifierResult = {
  verdict: "pass" | "fail";
  claims: VerifierClaim[];
  inputTokens: number;
  outputTokens: number;
  error?: string;
};

type ScoreResult = {
  hook_strength: number;
  specificity: number;
  emotional_pull: number;
  shareability: number;
  usefulness: {
    actionable_takeaway: boolean;
    contrarian_angle: boolean;
    data_or_example_led: boolean;
  };
  overall: number;
  fixes: string[];
  inputTokens: number;
  outputTokens: number;
  error?: string;
};

async function callClaude(
  apiKey: string,
  model: string,
  system: string,
  userMessage: string,
  maxTokens = 2048,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Claude API error [${resp.status}]: ${errText}`);
  }
  const data = await resp.json();
  return {
    text: (data.content?.[0]?.text ?? "").trim(),
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

function stripJsonFence(raw: string): string {
  return raw.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
}

// ===== CTA picker =====
type CtaRow = {
  id: string;
  copy: string;
  cta_type: string;
  weight: number;
  enabled: boolean;
};

function pickCta(ctas: CtaRow[], hardRatio: number): CtaRow | null {
  const enabled = ctas.filter((c) => c.enabled);
  if (enabled.length === 0) return null;
  const wantHard = Math.random() < hardRatio;
  const pool = enabled.filter((c) => c.cta_type === (wantHard ? "hard" : "soft"));
  const finalPool = pool.length > 0 ? pool : enabled;
  const totalWeight = finalPool.reduce((s, c) => s + Math.max(c.weight, 0.01), 0);
  let r = Math.random() * totalWeight;
  for (const c of finalPool) {
    r -= Math.max(c.weight, 0.01);
    if (r <= 0) return c;
  }
  return finalPool[finalPool.length - 1];
}

// ===== Voice fingerprint =====
const DEFAULT_FORBIDDEN = [
  "in today's fast-paced", "leverage", "unlock", "game-changer", "game changer",
  "revolutionise", "revolutionize", "harness the power", "deep dive",
  "at the end of the day", "truly", "simply put", "let me tell you",
  "ladies and gentlemen", "in today's world", "in today's digital", "moreover,",
  "furthermore,", "additionally,", "in conclusion", "it's important to note",
  "in this article", "in this post",
];

function parseForbiddenList(raw: string): string[] {
  return (raw || "")
    .split(/[;,\n]+/)
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 1);
}

function findForbiddenHits(text: string, list: string[]): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const p of list) {
    if (p.length < 2) continue;
    if (lower.includes(p)) hits.push(p);
  }
  return Array.from(new Set(hits));
}

/** 0-10 score of how Hajre-ish the draft sounds. Deterministic. */
function computeVoiceScore(text: string, forbiddenHits: string[]): {
  score: number;
  diagnostics: Record<string, unknown>;
} {
  let score = 10;
  score -= Math.min(forbiddenHits.length * 2, 6);

  const sentences = text.split(/[.!?]+\s/).map((s) => s.trim()).filter(Boolean);
  const words = text.split(/\s+/).filter(Boolean);
  const avgSentenceLen = sentences.length > 0 ? words.length / sentences.length : 0;
  if (avgSentenceLen > 25) score -= 1;
  if (avgSentenceLen > 32) score -= 1;

  const contractionRegex = /\b(I'm|don't|I've|you're|can't|won't|didn't|it's|that's|what's|isn't|aren't|we're|they're|wouldn't|couldn't|shouldn't|here's|there's)\b/gi;
  const contractionCount = (text.match(contractionRegex) || []).length;
  if (contractionCount === 0) score -= 2;

  const firstPersonCount = (text.match(/\b(I|me|my|mine|I'm|I've)\b/g) || []).length;
  if (firstPersonCount === 0) score -= 1;

  if (text.includes("—")) score -= 1;
  if (/[#]\w/.test(text)) score -= 1; // hashtags

  return {
    score: Math.max(0, Math.min(10, score)),
    diagnostics: {
      avg_sentence_len: Math.round(avgSentenceLen * 10) / 10,
      contraction_count: contractionCount,
      first_person_count: firstPersonCount,
      forbidden_hit_count: forbiddenHits.length,
      forbidden_hits: forbiddenHits,
      has_em_dash: text.includes("—"),
      has_hashtag: /[#]\w/.test(text),
    },
  };
}

async function brainstormHooks(
  apiKey: string,
  userMessage: string,
): Promise<{ hooks: Array<{ shape: string; text: string }>; inputTokens: number; outputTokens: number }> {
  try {
    const r = await callClaude(apiKey, CLAUDE_GENERATION_MODEL, HOOK_BRAINSTORM_PROMPT, userMessage, 600);
    const parsed = JSON.parse(stripJsonFence(r.text));
    const hooks = Array.isArray(parsed.hooks) ? parsed.hooks.filter((h: any) => h?.text) : [];
    return { hooks, inputTokens: r.inputTokens, outputTokens: r.outputTokens };
  } catch (e) {
    console.error("Hook brainstorm failed:", e);
    return { hooks: [], inputTokens: 0, outputTokens: 0 };
  }
}

async function verifyDraft(
  draft: string,
  sources: Array<{ title: string; source: string; summary: string | null }>,
  apiKey: string,
): Promise<VerifierResult> {
  const sourceBlock = sources
    .map((s, i) => `${i + 1}. ${s.title} (${s.source})\n   ${s.summary ?? ""}`)
    .join("\n");
  const userMsg = `SOURCE ITEMS:\n${sourceBlock}\n\nDRAFT POST:\n"""${draft}"""\n\nFact-check the draft against the sources. Return JSON only.`;

  try {
    const r = await callClaude(apiKey, CLAUDE_VERIFIER_MODEL, VERIFIER_SYSTEM_PROMPT, userMsg, 1500);
    const parsed = JSON.parse(stripJsonFence(r.text));
    const claims: VerifierClaim[] = Array.isArray(parsed.claims) ? parsed.claims : [];
    const verdict: "pass" | "fail" =
      parsed.verdict === "pass" && claims.every((c) => c.supported) ? "pass" : "fail";
    return { verdict, claims, inputTokens: r.inputTokens, outputTokens: r.outputTokens };
  } catch (e) {
    console.error("Verifier failed:", e);
    return { verdict: "fail", claims: [], inputTokens: 0, outputTokens: 0, error: String(e) };
  }
}

async function scoreDraft(draft: string, apiKey: string): Promise<ScoreResult> {
  const empty: ScoreResult = {
    hook_strength: 0, specificity: 0, emotional_pull: 0, shareability: 0,
    usefulness: { actionable_takeaway: false, contrarian_angle: false, data_or_example_led: false },
    overall: 0, fixes: [], inputTokens: 0, outputTokens: 0,
  };
  try {
    const r = await callClaude(
      apiKey,
      CLAUDE_VERIFIER_MODEL,
      SCORER_SYSTEM_PROMPT,
      `DRAFT POST:\n"""${draft}"""\n\nScore the draft. Return JSON only.`,
      800,
    );
    const parsed = JSON.parse(stripJsonFence(r.text));
    return {
      hook_strength: Number(parsed.hook_strength ?? 0),
      specificity: Number(parsed.specificity ?? 0),
      emotional_pull: Number(parsed.emotional_pull ?? 0),
      shareability: Number(parsed.shareability ?? 0),
      usefulness: {
        actionable_takeaway: !!parsed.usefulness?.actionable_takeaway,
        contrarian_angle: !!parsed.usefulness?.contrarian_angle,
        data_or_example_led: !!parsed.usefulness?.data_or_example_led,
      },
      overall: Number(parsed.overall ?? 0),
      fixes: Array.isArray(parsed.fixes) ? parsed.fixes.slice(0, 6).map(String) : [],
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
    };
  } catch (e) {
    console.error("Scorer failed:", e);
    return { ...empty, error: String(e) };
  }
}

function passesScoreBar(s: ScoreResult): boolean {
  return (
    s.overall >= 7.5 &&
    s.hook_strength >= 7 &&
    s.usefulness.actionable_takeaway &&
    (s.usefulness.contrarian_angle || s.usefulness.data_or_example_led)
  );
}

function engagementFromScore(s: ScoreResult): "high" | "medium" | "low" {
  if (passesScoreBar(s)) return "high";
  if (s.overall >= 6.5) return "medium";
  return "low";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const pillar = DAY_PILLARS[dayOfWeek];
    if (!pillar) throw new Error(`No content pillar for day ${dayOfWeek}`);
    const pillarLabel = PILLAR_LABELS[pillar];

    const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");
    if (!CLAUDE_API_KEY) throw new Error("CLAUDE_API_KEY is not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // News items (last 24h, today's pillar)
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: newsItems } = await supabase
      .from("news_items").select("*")
      .eq("pillar_match", pillar).gte("collected_at", yesterday)
      .order("relevance_score", { ascending: false }).limit(15);

    // AI landscape (last 48h) — always inject unless today is AI agents
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const { data: aiLandscape } = pillar === "ai_agents"
      ? { data: [] as any[] }
      : await supabase.from("news_items").select("*")
          .eq("pillar_match", "ai_agents").gte("collected_at", twoDaysAgo)
          .order("relevance_score", { ascending: false }).limit(8);

    // Voice samples
    const { data: voiceSamples } = await supabase
      .from("voice_samples").select("*")
      .order("performance_rating", { ascending: false }).limit(3);

    // CEO context (single row) + lead-magnet CTAs
    const { data: ceoCtx } = await supabase
      .from("ceo_context").select("*").limit(1).maybeSingle();
    const { data: ctaRows } = await supabase
      .from("cta_library").select("*").eq("enabled", true);
    const hardRatio = Number(ceoCtx?.hard_cta_ratio ?? 0.4);
    const selectedCta = ctaRows ? pickCta(ctaRows as CtaRow[], hardRatio) : null;
    const leadMagnetUrl = ceoCtx?.lead_magnet_url || "https://build.londonra.com";
    const forbiddenList = parseForbiddenList(ceoCtx?.forbidden_phrases || DEFAULT_FORBIDDEN.join(";"));

    // Recent rejections
    const { data: rejectedPosts } = await supabase
      .from("posts").select("content, rejection_reason")
      .not("rejection_reason", "is", null)
      .order("rejected_at", { ascending: false }).limit(3);

    // Winner few-shot: top published posts by engagement in last 90d (settled >=7d ago)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: publishedPool } = await supabase
      .from("posts").select("id, content, published_at")
      .eq("status", "published")
      .lte("published_at", sevenDaysAgo).gte("published_at", ninetyDaysAgo);

    let winners: Array<{ content: string; score: number }> = [];
    if (publishedPool && publishedPool.length > 0) {
      const ids = publishedPool.map((p) => p.id);
      const { data: metricsRows } = await supabase
        .from("post_metrics").select("post_id, likes, comments, reposts")
        .in("post_id", ids);
      const latestByPost = new Map<string, { likes: number; comments: number; reposts: number }>();
      (metricsRows ?? []).forEach((m: any) => {
        latestByPost.set(m.post_id, { likes: m.likes ?? 0, comments: m.comments ?? 0, reposts: m.reposts ?? 0 });
      });
      winners = publishedPool
        .map((p) => {
          const m = latestByPost.get(p.id) ?? { likes: 0, comments: 0, reposts: 0 };
          return { content: p.content as string, score: m.likes + 2 * m.comments + 3 * m.reposts };
        })
        .filter((w) => w.score > 0)
        .sort((a, b) => b.score - a.score).slice(0, 3);
    }

    const todayStr = now.toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    const newsSection = newsItems && newsItems.length > 0
      ? newsItems.map((n, i) => `${i + 1}. ${n.title} (${n.source}) — ${n.url}\n   ${n.summary}`).join("\n")
      : "No recent news items available.";

    const aiLandscapeSection = aiLandscape && aiLandscape.length > 0
      ? aiLandscape.map((n, i) => `${i + 1}. ${n.title} (${n.source}) — ${n.url}\n   ${n.summary}`).join("\n")
      : null;
    const aiLandscapeBlock = aiLandscapeSection
      ? `\nCURRENT AI LANDSCAPE (last 48h — reference these to keep the post grounded in what's actually happening, even though the pillar isn't AI. Only use if it fits naturally):\n${aiLandscapeSection}\n`
      : "";

    const voiceSection = voiceSamples && voiceSamples.length > 0
      ? voiceSamples.map((v) => `- "${v.content}"`).join("\n")
      : "No voice samples available.";

    const rejectSection = rejectedPosts && rejectedPosts.length > 0
      ? rejectedPosts.map((r) => `- Reason: ${r.rejection_reason}\n  Post excerpt: ${r.content?.slice(0, 150)}...`).join("\n")
      : "No previous rejections.";

    const winnersBlock = winners.length > 0
      ? `\nHIGH-PERFORMING PAST POSTS (match this energy — same voice, same level of specificity, same shape of hook):\n${winners.map((w, i) => `${i + 1}. (engagement ${w.score})\n"""${w.content}"""`).join("\n\n")}\n`
      : "";

    // CEO context block — keeps the agent grounded in Hajre's voice + worldview
    const ceoBlock = ceoCtx
      ? `\nWHO YOU ARE WRITING AS:
${ceoCtx.bio}

WORLDVIEW (use this as the lens — do not quote it verbatim):
${ceoCtx.worldview}

RECURRING STORIES YOU CAN DRAW FROM (use specifics, change details to keep it fresh, never fabricate):
${ceoCtx.recurring_stories}

FORBIDDEN PHRASES — never use these (instant rejection):
${ceoCtx.forbidden_phrases}
`
      : "";

    // CTA instruction (hard CTA goes in the body; soft CTA is reserved for the auto first-comment)
    const ctaInstruction = selectedCta && selectedCta.cta_type === "hard"
      ? `\nLEAD-MAGNET CTA (weave this in NATURALLY at the end — one short line, in Hajre's voice, do not bold or quote it):
"${selectedCta.copy}"
The URL ${leadMagnetUrl} must appear in the post.`
      : `\nDO NOT include any URLs or calls-to-action in the post body. The lead-magnet link will be posted as the first comment automatically.`;

    // Base context shared with hook + body
    const contextBlock = `Today is ${todayStr}. The content pillar for today is: ${pillarLabel}.
${ceoBlock}
NEWS ITEMS (source material, every named entity/number/study must come from here):
${newsSection}
${aiLandscapeBlock}
VOICE SAMPLES (match this tone):
${voiceSection}
${winnersBlock}
PREVIOUSLY REJECTED (avoid these patterns):
${rejectSection}`;

    // STAGE 1 — Hook brainstorm
    const hookBrainstorm = await brainstormHooks(
      CLAUDE_API_KEY,
      `${contextBlock}\n\nGenerate 3 distinct hooks for a ${pillarLabel} post.`,
    );
    const hookOptions = hookBrainstorm.hooks;
    const hookList = hookOptions.length > 0
      ? hookOptions.map((h, i) => `${i + 1}. [${h.shape}] ${h.text}`).join("\n")
      : "(hook brainstorm failed — pick the strongest opener yourself)";

    // STAGE 2 — Body around the winning hook
    const bodyUserMessage = `${contextBlock}

HOOK OPTIONS (pick the single strongest one, then build the post around it — you may sharpen the wording but keep its shape):
${hookList}
${ctaInstruction}

Write the full LinkedIn post for the ${pillarLabel} pillar. 150-350 words. Output ONLY the post text.`;

    let firstDraft = await callClaude(CLAUDE_API_KEY, CLAUDE_GENERATION_MODEL, SYSTEM_PROMPT, bodyUserMessage);
    let postContent = firstDraft.text;
    let genInputTokens = firstDraft.inputTokens;
    let genOutputTokens = firstDraft.outputTokens;

    // STAGE 3 — Fact-check verifier
    const verifierSources = [...(newsItems ?? []), ...(aiLandscape ?? [])].map((n) => ({
      title: n.title ?? "Untitled", source: n.source ?? "Unknown", summary: n.summary ?? null,
    }));

    let verifier = await verifyDraft(postContent, verifierSources, CLAUDE_API_KEY);
    let verifierInputTokens = verifier.inputTokens;
    let verifierOutputTokens = verifier.outputTokens;
    let verifierRetried = false;

    if (verifier.verdict === "fail") {
      const unsupported = verifier.claims.filter((c) => !c.supported)
        .map((c) => `- "${c.claim}" (${c.reason})`).join("\n");
      const retryMessage = `${bodyUserMessage}

⚠️ PREVIOUS ATTEMPT FAILED FACT-CHECK. These claims were NOT supported by source material:
${unsupported || "(rewrite cautiously)"}

Rewrite the post. Remove or rephrase every unsupported claim. Do not invent companies, people, products, statistics, numbers, dates, or studies that aren't in the supplied sources.`;
      const retryDraft = await callClaude(CLAUDE_API_KEY, CLAUDE_GENERATION_MODEL, SYSTEM_PROMPT, retryMessage);
      postContent = retryDraft.text;
      genInputTokens += retryDraft.inputTokens;
      genOutputTokens += retryDraft.outputTokens;
      verifierRetried = true;
      verifier = await verifyDraft(postContent, verifierSources, CLAUDE_API_KEY);
      verifierInputTokens += verifier.inputTokens;
      verifierOutputTokens += verifier.outputTokens;
    }

    // STAGE 4 — Virality + usefulness scorer
    let score = await scoreDraft(postContent, CLAUDE_API_KEY);
    let scorerInputTokens = score.inputTokens;
    let scorerOutputTokens = score.outputTokens;
    let scorerRetried = false;

    if (!passesScoreBar(score) && score.fixes.length > 0) {
      const fixList = score.fixes.map((f) => `- ${f}`).join("\n");
      const rewriteMessage = `${bodyUserMessage}

⚠️ The previous draft scored below the engagement bar. Apply these specific fixes and rewrite the full post:
${fixList}

Keep zero-fabrication rules. Output ONLY the post text.`;
      const rewrite = await callClaude(CLAUDE_API_KEY, CLAUDE_GENERATION_MODEL, SYSTEM_PROMPT, rewriteMessage);
      const candidate = rewrite.text;
      genInputTokens += rewrite.inputTokens;
      genOutputTokens += rewrite.outputTokens;

      // Re-verify the rewrite — never trade fabrication for engagement.
      const reverify = await verifyDraft(candidate, verifierSources, CLAUDE_API_KEY);
      verifierInputTokens += reverify.inputTokens;
      verifierOutputTokens += reverify.outputTokens;

      if (reverify.verdict === "pass") {
        postContent = candidate;
        verifier = reverify;
        verifierRetried = true;
        const rescore = await scoreDraft(postContent, CLAUDE_API_KEY);
        scorerInputTokens += rescore.inputTokens;
        scorerOutputTokens += rescore.outputTokens;
        if (rescore.overall >= score.overall) score = rescore;
        scorerRetried = true;
      } else {
        console.warn("Scorer rewrite failed re-verification — keeping original draft.");
      }
    }

    postContent = postContent.trim();

    // STAGE 5 — Voice fingerprint check (forbidden phrases + Hajre-ness score)
    let forbiddenHits = findForbiddenHits(postContent, forbiddenList);
    let voice = computeVoiceScore(postContent, forbiddenHits);
    let voiceRewriteAttempted = false;

    if (forbiddenHits.length > 0 || voice.score < 7) {
      voiceRewriteAttempted = true;
      const phraseList = forbiddenHits.length > 0
        ? forbiddenHits.map((p) => `- "${p}"`).join("\n")
        : "(no exact phrase hits, but the draft sounds AI-generated — make it more conversational and specifically British in tone)";
      const voiceRewriteMessage = `${bodyUserMessage}

⚠️ THE PREVIOUS DRAFT DID NOT SOUND LIKE HAJRE. Issues:
- Forbidden phrases / generic AI-isms found:
${phraseList}
- Voice score: ${voice.score}/10. Diagnostics: ${JSON.stringify(voice.diagnostics)}

Rewrite the entire post. Strip every forbidden phrase. Add contractions (I'm, don't, it's). Use shorter, varied sentences. Keep first person. British English. No em dashes. Make it sound like Hajre wrote it on the tube, not like ChatGPT. Output ONLY the post text.`;
      const voiceRewrite = await callClaude(CLAUDE_API_KEY, CLAUDE_GENERATION_MODEL, SYSTEM_PROMPT, voiceRewriteMessage);
      const candidate = voiceRewrite.text.trim();
      genInputTokens += voiceRewrite.inputTokens;
      genOutputTokens += voiceRewrite.outputTokens;

      // Re-verify the rewrite — never trade fabrication for voice.
      const reverify = await verifyDraft(candidate, verifierSources, CLAUDE_API_KEY);
      verifierInputTokens += reverify.inputTokens;
      verifierOutputTokens += reverify.outputTokens;
      if (reverify.verdict === "pass") {
        postContent = candidate;
        verifier = reverify;
        forbiddenHits = findForbiddenHits(postContent, forbiddenList);
        voice = computeVoiceScore(postContent, forbiddenHits);
      } else {
        console.warn("Voice rewrite failed re-verification — keeping original draft.");
      }
    }

    // Final engagement gate: must pass verifier AND voice score must be at least 6
    const engagement = (verifier.verdict === "pass" && voice.score >= 6)
      ? engagementFromScore(score)
      : "low";

    // Build the per-claim evidence list (sources that backed each verified claim)
    const verificationEvidence = verifier.claims.map((c) => {
      const src = c.source_index && c.source_index > 0
        ? verifierSources[c.source_index - 1]
        : null;
      return {
        claim: c.claim,
        type: c.type,
        supported: c.supported,
        reason: c.reason,
        source: src ? { title: src.title, source: src.source, summary: src.summary } : null,
      };
    });

    const apiCost =
      genInputTokens * INPUT_COST_PER_TOKEN +
      genOutputTokens * OUTPUT_COST_PER_TOKEN +
      hookBrainstorm.inputTokens * INPUT_COST_PER_TOKEN +
      hookBrainstorm.outputTokens * OUTPUT_COST_PER_TOKEN +
      (verifierInputTokens + scorerInputTokens) * INPUT_COST_PER_TOKEN +
      (verifierOutputTokens + scorerOutputTokens) * OUTPUT_COST_PER_TOKEN;
    const totalTokens =
      genInputTokens + genOutputTokens +
      hookBrainstorm.inputTokens + hookBrainstorm.outputTokens +
      verifierInputTokens + verifierOutputTokens +
      scorerInputTokens + scorerOutputTokens;

    const sourceMaterial = [
      ...(newsItems ?? []).map((n) => ({ id: n.id, title: n.title, source: n.source, url: n.url, relevance_score: n.relevance_score, kind: "pillar" as const })),
      ...(aiLandscape ?? []).map((n) => ({ id: n.id, title: n.title, source: n.source, url: n.url, relevance_score: n.relevance_score, kind: "ai_landscape" as const })),
    ];

    const verificationNotes = {
      verdict: verifier.verdict, retried: verifierRetried,
      claims: verifier.claims, verifier_error: verifier.error ?? null,
      checked_at: new Date().toISOString(),
    };

    const scoreBreakdown = {
      hook_strength: score.hook_strength,
      specificity: score.specificity,
      emotional_pull: score.emotional_pull,
      shareability: score.shareability,
      usefulness: score.usefulness,
      overall: score.overall,
      fixes: score.fixes,
      passes_bar: passesScoreBar(score),
      retried: scorerRetried,
      hooks_considered: hookOptions,
      winners_injected: winners.length,
      scorer_error: score.error ?? null,
    };

    const { data: newPost, error: postError } = await supabase
      .from("posts").insert({
        content: postContent, pillar, status: "draft", format: "text",
        suggested_time: DAY_SUGGESTED_TIMES[dayOfWeek] ?? "09:00:00",
        engagement_estimate: engagement,
        source_material: sourceMaterial,
        verification_status: verifier.verdict === "pass" ? "passed" : "failed",
        verification_notes: verificationNotes,
        verification_evidence: verificationEvidence,
        virality_score: score.overall,
        voice_score: voice.score,
        score_breakdown: scoreBreakdown,
        cta_id: selectedCta?.id ?? null,
        first_comment_text: selectedCta && selectedCta.cta_type === "soft" ? selectedCta.copy : null,
      })
      .select("id").single();

    if (postError) throw new Error(`Insert post failed: ${postError.message}`);

    // Bump CTA usage counter
    if (selectedCta) {
      await supabase
        .from("cta_library")
        .update({ times_used: (ctaRows?.find((c: any) => c.id === selectedCta.id)?.times_used ?? 0) + 1 })
        .eq("id", selectedCta.id);
    }

    // Persist every hook brainstormed for this draft.
    // Mark the first one as "was_selected" — the body prompt instructs Claude
    // to "pick the strongest one"; we can refine this later with a dedicated picker.
    if (hookOptions.length > 0) {
      const hookRows = hookOptions.map((h, i) => ({
        post_id: newPost.id,
        shape: h.shape ?? "unknown",
        text: h.text,
        was_selected: i === 0,
      }));
      await supabase.from("hook_variants").insert(hookRows);
    }

    await supabase.from("agent_log").insert({
      action: "draft_generated",
      api_cost_usd: parseFloat(apiCost.toFixed(6)),
      tokens_used: totalTokens,
      details: {
        pillar, model: CLAUDE_GENERATION_MODEL, verifier_model: CLAUDE_VERIFIER_MODEL,
        hook_input_tokens: hookBrainstorm.inputTokens, hook_output_tokens: hookBrainstorm.outputTokens,
        gen_input_tokens: genInputTokens, gen_output_tokens: genOutputTokens,
        verifier_input_tokens: verifierInputTokens, verifier_output_tokens: verifierOutputTokens,
        scorer_input_tokens: scorerInputTokens, scorer_output_tokens: scorerOutputTokens,
        post_id: newPost.id,
        news_items_count: newsItems?.length ?? 0,
        ai_landscape_count: aiLandscape?.length ?? 0,
        winners_count: winners.length,
        verification_status: verifier.verdict === "pass" ? "passed" : "failed",
        verifier_retried: verifierRetried,
        unsupported_claim_count: verifier.claims.filter((c) => !c.supported).length,
        virality_score: score.overall,
        voice_score: voice.score,
        voice_diagnostics: voice.diagnostics,
        voice_rewrite_attempted: voiceRewriteAttempted,
        engagement_estimate: engagement,
        scorer_retried: scorerRetried,
        cta_id: selectedCta?.id ?? null,
        cta_type: selectedCta?.cta_type ?? null,
      },
    });

    return new Response(
      JSON.stringify({
        status: "success", post_id: newPost.id,
        cost: parseFloat(apiCost.toFixed(6)),
        verification_status: verifier.verdict === "pass" ? "passed" : "failed",
        engagement_estimate: engagement,
        virality_score: score.overall,
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
