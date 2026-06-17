const LEAD_URL = "https://build.londonra.com";

function compact(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function trimWords(text: string, maxWords: number) {
  const words = compact(text).split(" ").filter(Boolean);
  return words.slice(0, maxWords).join(" ");
}

function trimChars(text: string, maxChars: number) {
  const clean = compact(text);
  return clean.length <= maxChars ? clean : `${clean.slice(0, maxChars - 1).trim()}…`;
}

function sentencesFromDraft(draftContent: string) {
  const sentences = compact(draftContent)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^[-•]\s*/, "").trim())
    .filter((s) => s.length > 18)
    .slice(0, 8);

  return sentences.length ? sentences : [compact(draftContent) || "AI readiness needs clearer thinking before louder tooling."];
}

export function makeCarouselFallback(draftContent: string) {
  const sentences = sentencesFromDraft(draftContent);
  const first = sentences[0];
  const lead = sentences[1] ?? "Most teams do not need more AI noise; they need a clearer decision rhythm.";

  return {
    title: trimChars(first, 54),
    slides: [
      {
        n: 1,
        headline: trimWords(first, 7) || "The real AI question",
        body: trimChars(lead, 118),
        visual_direction: "A bold editorial opener with one clear focal point.",
        icon_hint: "Sparkles",
      },
      {
        n: 2,
        headline: "Where the work stalls",
        body: trimChars(sentences[2] ?? "The difficult bit is rarely the tool. It is judgement, ownership, process and confidence.", 118),
        visual_direction: "A simple bottleneck diagram, not a busy process map.",
        icon_hint: "GitBranch",
      },
      {
        n: 3,
        headline: "Leaders need evidence",
        body: trimChars(sentences[3] ?? "A better AI decision starts with what is known, what is assumed, and what needs testing.", 118),
        visual_direction: "Three stacked evidence blocks with a checked source marker.",
        icon_hint: "ShieldCheck",
      },
      {
        n: 4,
        headline: "Teams need permission",
        body: trimChars(sentences[4] ?? "Adoption improves when people know what good use looks like, and what is off-limits.", 118),
        visual_direction: "Human-centred workspace with clear guardrails.",
        icon_hint: "Users",
      },
      {
        n: 5,
        headline: "Start with readiness",
        body: "Before another shiny AI tool, check where your organisation is strong, guessing, or exposed.",
        visual_direction: "Scorecard-style layout with three calm readiness signals.",
        icon_hint: "ClipboardCheck",
      },
      {
        n: 6,
        headline: "Useful next step",
        body: `If this hits a nerve, start with the AI Readiness Scorecard: ${LEAD_URL}`,
        visual_direction: "Clean closing slide with a single URL and no hard sell.",
        icon_hint: "ArrowRight",
      },
    ],
    caption: `${trimChars(first, 120)}\n\nThe useful question is not “which tool?” It is “are we ready to use it well?”\n\n${LEAD_URL}`,
    sources: [],
    isFallback: true,
  };
}

export function makePollFallback(draftContent: string) {
  const first = sentencesFromDraft(draftContent)[0];
  return {
    question: "Where is AI getting stuck?",
    options: ["Strategy", "Skills", "Governance", "Adoption"],
    caption: `${trimChars(first, 140)}\n\nQuick sense-check: where does AI most often get stuck inside an organisation?`,
    follow_up_comment: `If the answer is “a bit of everything”, the AI Readiness Scorecard is a useful place to start: ${LEAD_URL}`,
    reply_strategy: "Reply to voters by asking what they have already tried, then offer one practical next step rather than a pitch.",
    cta: `Useful starting point: ${LEAD_URL}`,
    isFallback: true,
  };
}

export function makeImageFallback(draftContent: string) {
  const first = sentencesFromDraft(draftContent)[0];
  return {
    concept: "A calm executive command-centre image about AI readiness, not hype.",
    overlay_text: trimWords(first, 5) || "Readiness before noise",
    style: "Dark editorial command-centre look, crisp typography, subtle grid, one readiness signal, no fake screenshots or logos.",
    image_prompt: `Create a square LinkedIn image with the overlay text “${trimWords(first, 5)}”. Dark command-centre editorial style, crisp grid, calm executive AI readiness theme, no fake logos, no fake screenshots, no extra text.`,
    caption: `${trimChars(first, 160)}\n\nIf your team is talking about AI but still relying on guesswork, start with readiness.`,
    first_comment: `A useful starting point is the AI Readiness Scorecard: ${LEAD_URL}`,
    risk_notes: "Fallback visual generated from the draft. Review the overlay line before posting.",
    isFallback: true,
  };
}

export function makeInfographicFallback(draftContent: string) {
  const sentences = sentencesFromDraft(draftContent);
  return {
    title: trimWords(sentences[0], 6) || "AI readiness signals",
    subtitle: "A quick CEO sense-check",
    blocks: [
      { label: "Signal", value: "", note: trimChars(sentences[0], 72), icon: "Radar" },
      { label: "Risk", value: "", note: trimChars(sentences[1] ?? "Tools move faster than organisational confidence.", 72), icon: "AlertTriangle" },
      { label: "Decision", value: "", note: trimChars(sentences[2] ?? "Leaders need clearer criteria before scaling adoption.", 72), icon: "Compass" },
      { label: "Next", value: "", note: "Use readiness to turn AI interest into practical action.", icon: "ClipboardCheck" },
    ],
    caption: `${trimChars(sentences[0], 120)}\n\nAI readiness is what turns attention into action. ${LEAD_URL}`,
    sources: [],
    isFallback: true,
  };
}