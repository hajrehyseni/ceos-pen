import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { sanitizeDraftContent } from "../_shared/content-sanitize.ts";
import {
  SCORECARD_URL,
  DEFAULT_SOFT_CTA as SHARED_SOFT_CTA,
  DEFAULT_HARD_CTA as SHARED_HARD_CTA,
  ensureScorecard,
  normaliseScorecardUrl,
} from "../_shared/scorecard.ts";


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

const SYSTEM_PROMPT = `You are CEO PEN — ghostwriting for Hajrë, founder of London Royal Academy. Write posts people REMEMBER. Voice: warm, human, slightly witty British founder. Smart-friend-down-the-pub tone — not LinkedIn comedian. Conversational, clever-but-simple, slightly cheeky when it lands, easy to read, memorable, commercially useful. Sounds written by a real person, not an AI.

BRITISH HUMOUR — use it lightly and well:
- Mild self-awareness, everyday observations, "cup of tea" moments, gentle irony, playful comparisons, founder honesty.
- One small witty line per post is plenty. Two if it really sings.
- Never force it. No forced jokes, no cringe, no fake drama, no American hype ("game-changer", "unlock", "10x"), no corporate motivational nonsense, no over-polished AI wording.
- The humour should make people smile, remember the idea, and want to reply.

RULES: plain English, short sentences, fragments OK, contractions (I'm, don't, we've), British English (optimise, organise, behaviour, colour, centre). No transitions like Moreover/Additionally/In today's world. No AI-transforming-everything openers. No lists-as-insights. Every sentence earns its place.

HOOKS create: tension, contradiction, curiosity, emotional truth, or surprise. Never: "AI is changing everything" / "Here's what I learned" / "5 things" / "most important skill in 2024".

STORIES come from real moments: meetings gone wrong, training sessions, AI implementations that broke, founder conversations, workflow failures, executive surprises. Use scenes, tension, contrast, occasional dialogue, uncomfortable truths. 150-350 words. Shapes: Scene, Observation, Confession, Contrast.

OPERATING CONSTRAINTS (non-negotiable)
- ZERO FABRICATION. Never invent companies, people, products, institutions, statistics, percentages, dates, monetary amounts, study names, or citations. Every named entity, number, and study reference must come from the supplied NEWS ITEMS or CURRENT AI LANDSCAPE. If a fact isn't supported, omit it or describe the pattern in your own words.
- Personal anecdotes, scenes, opinions and observations are first-person voice and don't need a source.
- USEFULNESS BAR — every post must: (1) deliver one concrete, actionable takeaway or lesson, (2) challenge a common assumption OR anchor on a specific number/named example from sources, (3) cut anything that could appear on any other LinkedIn post.
- No hashtags. No emojis. No em dashes if you can avoid them.
- Output ONLY the post text — no preamble, no title, no commentary.
- You may use the CURRENT AI LANDSCAPE items to feel timely, but only if it fits the pillar. Never force it.

LEAD MAGNET — London Royal Academy's "Build to Certify" AI readiness scorecard at https://build.londonra.com. When a CTA is requested, weave it in as a helpful next step, in Hajrë's voice. Never "click here", never desperate, never salesy. The post must deliver value even if the reader never clicks. The link should feel like the obvious next step after the insight.`;

const HOOK_BRAINSTORM_PROMPT = `You generate LinkedIn HOOKS only — the first 1-2 lines of a post. Return exactly 3 hook options, each using a DIFFERENT shape:
1. TENSION — two things that shouldn't co-exist, do.
2. CONFESSION — admit something most people in your position won't.
3. SCENE — a specific moment, dialogue, or sensory detail.

Each hook: 1-2 sentences, max 30 words, no emoji, no hashtags, no em dashes, British English. Grounded in the supplied news items where possible (no fabrication).

OPENER DIVERSITY (critical): do NOT start any hook with these tired verbs/phrasings: "I watched", "I've noticed", "I'm watching", "I've been thinking", "Here's what", "Most people", "Everyone's", "Let me tell you". You will be given the openers of the last few posts — your three new hooks must each start with a different verb, noun, or rhetorical move from each other AND from the recent ones.

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

const SCORER_SYSTEM_PROMPT = `You score LinkedIn posts for VIRALITY, USEFULNESS, BRITISH HUMOUR FIT, and LEAD-MAGNET FIT. Be harsh — a 7 means genuinely strong, a 9 means top 1%.

Rate each axis 0-10:
- hook_strength: do the first 1-2 lines force the reader to keep reading?
- specificity: concrete entities, numbers, named examples, real moments — not generic.
- emotional_pull: tension, surprise, recognition, or discomfort?
- shareability: would a thoughtful operator quote-share this with a comment?
- humour_fit: does any wit feel natural (warm, British, founder-down-the-pub), protect credibility, and make the post more memorable? 10 = lands perfectly. 7 = one good line, doesn't try too hard. 4 = forced, cringe, or American hype. 10 is also valid for posts with NO humour where humour would have been wrong — judge on fit, not presence.
- lead_magnet_fit: You will be told the CTA_MODE for this draft. If CTA_MODE is "soft", the post body MUST NOT contain a URL — the link will be posted as an auto first-comment. In soft mode, score 10 by default; only deduct if the body weirdly tries to plug something. If CTA_MODE is "hard", a CTA + URL to https://build.londonra.com should appear in the body: score 10 if it's natural, in-voice, and a clear next step; 5 if present but clunky; 3 if salesy or "click-here".

Usefulness booleans:
- actionable_takeaway, contrarian_angle, data_or_example_led.

overall = 0.30*hook + 0.18*specificity + 0.18*emotional + 0.22*shareability + 0.07*humour_fit + 0.05*lead_magnet_fit.

predicted_reach_band — your honest bet on how this will perform on Hajrë's LinkedIn:
- "breakout": rare — top-of-feed, quote-shared by operators, likely 20k+ impressions. Only when hook AND specificity AND emotional_pull are all >=8.
- "high": strong performer, likely 5k-20k impressions. overall >=7.5 with a real hook.
- "mid": ok but forgettable, likely 1k-5k impressions.
- "low": scroll-past. Weak hook or generic body.

verdict — ONE sentence in Hajrë's voice (British, warm, direct, no jargon). Explain the ceiling AND the single biggest fix. Example: "Punchy hook, but the middle drags — cut lines 4-5 and this could land properly."

fixes: 1-4 SHORT, specific rewrites. Empty if overall >= 8.

Return ONLY valid JSON, no markdown:
{
  "hook_strength": 0-10,
  "specificity": 0-10,
  "emotional_pull": 0-10,
  "shareability": 0-10,
  "humour_fit": 0-10,
  "lead_magnet_fit": 0-10,
  "usefulness": { "actionable_takeaway": bool, "contrarian_angle": bool, "data_or_example_led": bool },
  "overall": 0-10,
  "predicted_reach_band": "low"|"mid"|"high"|"breakout",
  "verdict": "one sentence in Hajrë's voice",
  "fixes": ["...", "..."]
}`;

const CLAUDE_GENERATION_MODEL = "claude-sonnet-4-5";
const CLAUDE_VERIFIER_MODEL = "claude-sonnet-4-5";

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

type ReachBand = "low" | "mid" | "high" | "breakout";

type ScoreResult = {
  hook_strength: number;
  specificity: number;
  emotional_pull: number;
  shareability: number;
  humour_fit: number;
  lead_magnet_fit: number;
  usefulness: {
    actionable_takeaway: boolean;
    contrarian_angle: boolean;
    data_or_example_led: boolean;
  };
  overall: number;
  predicted_reach_band: ReachBand;
  verdict: string;
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

// Default scorecard CTAs — used when the cta_library has no enabled rows so
// every draft is guaranteed to carry the Build to Certify link.
const DEFAULT_SCORECARD_URL = SCORECARD_URL;
const DEFAULT_SOFT_CTA = SHARED_SOFT_CTA;
const DEFAULT_HARD_CTA = SHARED_HARD_CTA;


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

// Guarantee a CTA — falls back to a synthesized default when the library is empty.
function ensureCta(ctas: CtaRow[] | null, hardRatio: number): CtaRow {
  const picked = ctas ? pickCta(ctas, hardRatio) : null;
  if (picked) return picked;
  const wantHard = Math.random() < hardRatio;
  return {
    id: wantHard ? "default-hard" : "default-soft",
    copy: wantHard ? DEFAULT_HARD_CTA : DEFAULT_SOFT_CTA,
    cta_type: wantHard ? "hard" : "soft",
    weight: 1,
    enabled: true,
  };
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
  recentOpeners: string[],
): Promise<{ hooks: Array<{ shape: string; text: string }>; inputTokens: number; outputTokens: number }> {
  try {
    const openerBlock = recentOpeners.length > 0
      ? `\n\nRECENT POST OPENERS (do NOT echo their first 4 words or verb):\n${recentOpeners.map((o, i) => `${i + 1}. ${o}`).join("\n")}`
      : "";
    const r = await callClaude(apiKey, CLAUDE_GENERATION_MODEL, HOOK_BRAINSTORM_PROMPT, userMessage + openerBlock, 600);
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

function normaliseBand(raw: unknown, overall: number): ReachBand {
  const s = String(raw ?? "").toLowerCase();
  if (s === "breakout" || s === "high" || s === "mid" || s === "low") return s as ReachBand;
  if (overall >= 8.5) return "breakout";
  if (overall >= 7.5) return "high";
  if (overall >= 6) return "mid";
  return "low";
}

async function scoreDraft(draft: string, apiKey: string, ctaMode: "hard" | "soft"): Promise<ScoreResult> {
  const empty: ScoreResult = {
    hook_strength: 0, specificity: 0, emotional_pull: 0, shareability: 0,
    humour_fit: 0, lead_magnet_fit: 0,
    usefulness: { actionable_takeaway: false, contrarian_angle: false, data_or_example_led: false },
    overall: 0, predicted_reach_band: "low", verdict: "", fixes: [], inputTokens: 0, outputTokens: 0,
  };
  try {
    const r = await callClaude(
      apiKey,
      CLAUDE_VERIFIER_MODEL,
      SCORER_SYSTEM_PROMPT,
      `CTA_MODE: ${ctaMode}\n\nDRAFT POST:\n"""${draft}"""\n\nScore the draft. Return JSON only.`,
      900,
    );
    const parsed = JSON.parse(stripJsonFence(r.text));
    const overall = Number(parsed.overall ?? 0);
    return {
      hook_strength: Number(parsed.hook_strength ?? 0),
      specificity: Number(parsed.specificity ?? 0),
      emotional_pull: Number(parsed.emotional_pull ?? 0),
      shareability: Number(parsed.shareability ?? 0),
      humour_fit: Number(parsed.humour_fit ?? 7),
      lead_magnet_fit: Number(parsed.lead_magnet_fit ?? 7),
      usefulness: {
        actionable_takeaway: !!parsed.usefulness?.actionable_takeaway,
        contrarian_angle: !!parsed.usefulness?.contrarian_angle,
        data_or_example_led: !!parsed.usefulness?.data_or_example_led,
      },
      overall,
      predicted_reach_band: normaliseBand(parsed.predicted_reach_band, overall),
      verdict: typeof parsed.verdict === "string" ? parsed.verdict.trim().slice(0, 220) : "",
      fixes: Array.isArray(parsed.fixes) ? parsed.fixes.slice(0, 6).map(String) : [],
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
    };
  } catch (e) {
    console.error("Scorer failed:", e);
    return { ...empty, error: String(e) };
  }
}

// Cheap bag-of-words Jaccard similarity to find the closest winning post.
function tokenise(text: string): Set<string> {
  const stop = new Set(["the","a","an","and","or","but","if","in","on","at","to","of","for","is","it","this","that","with","as","by","from","be","are","was","were","i","you","we","they","my","your","our","their","me","us","them","so","not","no","yes","do","don't","just","really","very","also","about","into","out","up","down","over","then","than","because"]);
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s']/g, " ").split(/\s+/)
      .filter((w) => w.length > 2 && !stop.has(w))
  );
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}
function findClosestWinner(
  draft: string,
  winners: Array<{ id: string; content: string; score: number }>,
): { id: string; similarity: number; excerpt: string; score: number } | null {
  if (winners.length === 0) return null;
  const draftTokens = tokenise(draft);
  let best: { id: string; similarity: number; excerpt: string; score: number } | null = null;
  for (const w of winners) {
    const sim = jaccard(draftTokens, tokenise(w.content));
    if (!best || sim > best.similarity) {
      best = { id: w.id, similarity: sim, excerpt: w.content.slice(0, 180), score: w.score };
    }
  }
  return best && best.similarity > 0.05 ? best : null;
}

function passesScoreBar(s: ScoreResult): boolean {
  return (
    s.overall >= 7.5 &&
    s.hook_strength >= 7 &&
    s.humour_fit >= 6 &&
    s.lead_magnet_fit >= 6 &&
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
    const selectedCta = ensureCta(ctaRows as CtaRow[] | null, hardRatio);
    const usedDefaultCta = selectedCta.id === "default-hard" || selectedCta.id === "default-soft";
    const leadMagnetUrl = ceoCtx?.lead_magnet_url || DEFAULT_SCORECARD_URL;
    const forbiddenList = parseForbiddenList(ceoCtx?.forbidden_phrases || DEFAULT_FORBIDDEN.join(";"));

    // Fresh trends (last 5 days), prefer today's pillar
    const { data: trendRows } = await supabase
      .from("trend_radar")
      .select("title, summary, angle, counter_take, source_url, heat_score, pillar")
      .gte("expires_at", new Date().toISOString())
      .order("heat_score", { ascending: false })
      .limit(8);
    const relevantTrends = (trendRows ?? [])
      .sort((a: any, b: any) => {
        const aMatch = a.pillar === pillar ? 1 : 0;
        const bMatch = b.pillar === pillar ? 1 : 0;
        if (aMatch !== bMatch) return bMatch - aMatch;
        return (b.heat_score ?? 0) - (a.heat_score ?? 0);
      })
      .slice(0, 3);

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

    let winners: Array<{ id: string; content: string; score: number }> = [];
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
          return { id: p.id as string, content: p.content as string, score: m.likes + 2 * m.comments + 3 * m.reposts };
        })
        .filter((w) => w.score > 0)
        .sort((a, b) => b.score - a.score).slice(0, 10);
    }

    // Loser corpus — bottom quartile of scored posts, used as "avoid these" signal.
    let losers: Array<{ content: string; score: number }> = [];
    if (publishedPool && publishedPool.length >= 8) {
      const ids = publishedPool.map((p) => p.id);
      const { data: metricsRows2 } = await supabase
        .from("post_metrics").select("post_id, likes, comments, reposts").in("post_id", ids);
      const latest = new Map<string, { likes: number; comments: number; reposts: number }>();
      (metricsRows2 ?? []).forEach((m: any) => {
        latest.set(m.post_id, { likes: m.likes ?? 0, comments: m.comments ?? 0, reposts: m.reposts ?? 0 });
      });
      const scored = publishedPool.map((p) => {
        const m = latest.get(p.id) ?? { likes: 0, comments: 0, reposts: 0 };
        return { content: p.content as string, score: m.likes + 2 * m.comments + 3 * m.reposts };
      }).sort((a, b) => a.score - b.score);
      const cutoff = Math.max(1, Math.floor(scored.length / 4));
      losers = scored.slice(0, cutoff).slice(0, 5);
    }

    // Resonance summary (rolling insight from comment_insights) — optional.
    const { data: resonanceRow } = await supabase
      .from("settings").select("value").eq("key", "resonance_summary").maybeSingle();
    const resonanceSummary = resonanceRow?.value ?? null;

    // Active system prompt from registry (falls back to hardcoded SYSTEM_PROMPT).
    const { data: activePrompt } = await supabase
      .from("prompt_registry").select("version, template")
      .eq("name", "generate_draft_system").eq("active", true)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const activePromptVersion = activePrompt?.version ?? "v1";
    const activeSystemPrompt = (activePrompt?.template && !activePrompt.template.startsWith("SEED_PLACEHOLDER"))
      ? activePrompt.template
      : SYSTEM_PROMPT;

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

    const losersBlock = losers.length > 0
      ? `\nLOW-PERFORMING PAST POSTS (bottom quartile — do NOT reproduce their patterns, hooks, or shape. If your draft resembles any of these, rewrite it):\n${losers.map((l, i) => `${i + 1}. (engagement ${l.score})\n"""${l.content.slice(0, 400)}"""`).join("\n\n")}\n`
      : "";

    const resonanceBlock = resonanceSummary
      ? `\nWHAT REAL READERS RESPOND TO (mined from recent LinkedIn comments — lean into these angles, avoid the friction points):\n${resonanceSummary}\n`
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
    const ctaInstruction = selectedCta.cta_type === "hard"
      ? `\nLEAD-MAGNET CTA (weave this in NATURALLY at the end — one short line, in Hajre's voice, do not bold or quote it):
"${selectedCta.copy}"
The URL ${leadMagnetUrl} MUST appear in the post body exactly once.`
      : `\nDO NOT include any URLs or calls-to-action in the post body. The lead-magnet link will be posted as the first comment automatically.`;

    const trendsBlock = relevantTrends.length > 0
      ? `\nFRESH TREND RADAR (last 5 days — optional source material, use if it fits the pillar naturally; never fabricate):\n${relevantTrends.map((t: any, i: number) => `${i + 1}. ${t.title} (heat ${t.heat_score})\n   ${t.summary}\n   Angle: ${t.angle ?? "—"}\n   Counter-take: ${t.counter_take ?? "—"}${t.source_url ? `\n   URL: ${t.source_url}` : ""}`).join("\n")}\n`
      : "";

    // Base context shared with hook + body
    const contextBlock = `Today is ${todayStr}. The content pillar for today is: ${pillarLabel}.
${ceoBlock}
NEWS ITEMS (source material, every named entity/number/study must come from here):
${newsSection}
${aiLandscapeBlock}${trendsBlock}
VOICE SAMPLES (match this tone):
${voiceSection}
${winnersBlock}${losersBlock}${resonanceBlock}PREVIOUSLY REJECTED (avoid these patterns):
${rejectSection}`;

    // Recent openers (last 5 drafts) — feed into hook brainstorm for diversity
    const { data: recentPosts } = await supabase
      .from("posts").select("content")
      .order("created_at", { ascending: false }).limit(5);
    const recentOpeners = (recentPosts ?? [])
      .map((p: any) => (p.content ?? "").split(/\n/)[0].trim().slice(0, 120))
      .filter((s: string) => s.length > 0);

    const ctaMode: "hard" | "soft" = selectedCta.cta_type === "hard" ? "hard" : "soft";

    // STAGE 1 — Hook brainstorm
    const hookBrainstorm = await brainstormHooks(
      CLAUDE_API_KEY,
      `${contextBlock}\n\nGenerate 3 distinct hooks for a ${pillarLabel} post.`,
      recentOpeners,
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

    let firstDraft = await callClaude(CLAUDE_API_KEY, CLAUDE_GENERATION_MODEL, activeSystemPrompt, bodyUserMessage);
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
      const retryDraft = await callClaude(CLAUDE_API_KEY, CLAUDE_GENERATION_MODEL, activeSystemPrompt, retryMessage);
      postContent = retryDraft.text;
      genInputTokens += retryDraft.inputTokens;
      genOutputTokens += retryDraft.outputTokens;
      verifierRetried = true;
      verifier = await verifyDraft(postContent, verifierSources, CLAUDE_API_KEY);
      verifierInputTokens += verifier.inputTokens;
      verifierOutputTokens += verifier.outputTokens;
    }

    // STAGE 4 — Virality + usefulness scorer
    let score = await scoreDraft(postContent, CLAUDE_API_KEY, ctaMode);
    let scorerInputTokens = score.inputTokens;
    let scorerOutputTokens = score.outputTokens;
    let scorerRetried = false;

    if (!passesScoreBar(score) && score.fixes.length > 0) {
      const fixList = score.fixes.map((f) => `- ${f}`).join("\n");
      const rewriteMessage = `${bodyUserMessage}

⚠️ The previous draft scored below the engagement bar. Apply these specific fixes and rewrite the full post:
${fixList}

Keep zero-fabrication rules. Output ONLY the post text.`;
      const rewrite = await callClaude(CLAUDE_API_KEY, CLAUDE_GENERATION_MODEL, activeSystemPrompt, rewriteMessage);
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
        const rescore = await scoreDraft(postContent, CLAUDE_API_KEY, ctaMode);
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
      const voiceRewrite = await callClaude(CLAUDE_API_KEY, CLAUDE_GENERATION_MODEL, activeSystemPrompt, voiceRewriteMessage);
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

    // STAGE 6 — Final pre-save sanitiser: strip em-dashes, markdown bold, hashtags, blockquotes
    const sanitiseResult = sanitizeDraftContent(postContent);
    postContent = sanitiseResult.text;

    // STAGE 6b — Scorecard guarantee. Single source of truth: normalise any
    // bare/http references to the canonical https URL, then ensure the link
    // appears in body or first comment per CTA mode.
    let firstCommentText: string | null = selectedCta.cta_type === "soft" ? selectedCta.copy : null;
    const ensured = ensureScorecard(postContent, firstCommentText, ctaMode);
    postContent = ensured.body;
    firstCommentText = ensured.firstComment;

    // Recompute voice score post-sanitise so diagnostics reflect what's actually saved
    forbiddenHits = findForbiddenHits(postContent, forbiddenList);
    voice = computeVoiceScore(postContent, forbiddenHits);


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

    const closestWinner = findClosestWinner(postContent, winners);

    const scoreBreakdown = {
      hook_strength: score.hook_strength,
      specificity: score.specificity,
      emotional_pull: score.emotional_pull,
      shareability: score.shareability,
      humour_fit: score.humour_fit,
      lead_magnet_fit: score.lead_magnet_fit,
      usefulness: score.usefulness,
      overall: score.overall,
      predicted_reach_band: score.predicted_reach_band,
      verdict: score.verdict,
      closest_winner: closestWinner,
      fixes: score.fixes,
      passes_bar: passesScoreBar(score),
      retried: scorerRetried,
      hooks_considered: hookOptions,
      winners_injected: winners.length,
      scorer_error: score.error ?? null,
      sanitiser: sanitiseResult.diagnostics,
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
        cta_id: usedDefaultCta ? null : selectedCta.id,
        first_comment_text: firstCommentText,
      })
      .select("id").single();

    if (postError) throw new Error(`Insert post failed: ${postError.message}`);

    // Bump CTA usage counter (only for real library rows, not the synthesized default)
    if (!usedDefaultCta) {
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
        cta_id: usedDefaultCta ? null : selectedCta.id,
        cta_type: selectedCta.cta_type,
        cta_default_used: usedDefaultCta,
        scorecard_in_body: ctaMode === "hard",
        scorecard_in_first_comment: ctaMode === "soft",
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
