// Shared scorer for visual assets — runs after generation and returns 6 sub-scores + overall + notes.
// Used by gen-carousel, gen-poll, gen-image-post, gen-infographic, gen-chart.

import { CLAUDE_MODEL } from "./visual-asset.ts";

export interface VisualQuality {
  overall: number;
  mobile_readability: number;
  visual_clarity: number;
  hook_strength: number;
  cta_fit: number;
  source_confidence: number;
  export_readiness: number;
  notes: string[];
}

const SYSTEM = `You are a strict quality reviewer for LinkedIn visual assets created for Hajrë, founder of London Royal Academy.

Score the asset on 6 dimensions, each 0-10:
- mobile_readability: text size, line length, contrast — readable on a phone in 2 seconds.
- visual_clarity: composition, hierarchy, not overcrowded, one idea per element.
- hook_strength: first slide / poll question / overlay / title grabs attention.
- cta_fit: the link https://build.londonra.com (if present) reads as a useful next step. If absent and the topic doesn't need it, score 10. If shoved in awkwardly, score low.
- source_confidence: every factual claim ties back to provided sources. Fabrication = 0.
- export_readiness: ready to post on LinkedIn today with zero edits.

Return ONLY valid JSON, no prose:
{ "mobile_readability": n, "visual_clarity": n, "hook_strength": n, "cta_fit": n, "source_confidence": n, "export_readiness": n, "notes": ["short critique 1", "short critique 2"] }

Notes: maximum 4 entries, each ≤ 15 words, only the most actionable issues.`;

export async function scoreVisual(
  apiKey: string,
  kind: string,
  payload: any,
  sources: any[] = [],
): Promise<VisualQuality> {
  const sourceLines = sources
    .slice(0, 5)
    .map((s: any) => `- ${s.title ?? ""} :: ${s.url ?? ""}`)
    .join("\n");

  const user = `Asset kind: ${kind}

Payload to evaluate (JSON):
${JSON.stringify(payload, null, 2)}

Verified sources available to the generator:
${sourceLines || "(none)"}

Return the JSON scorecard now.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 600,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!resp.ok) {
    // Don't fail the asset if scoring fails — return a neutral score.
    return {
      overall: 7,
      mobile_readability: 7,
      visual_clarity: 7,
      hook_strength: 7,
      cta_fit: 7,
      source_confidence: 7,
      export_readiness: 7,
      notes: [`Scorer unavailable (${resp.status}).`],
    };
  }
  const data = await resp.json();
  let text = (data.content?.[0]?.text ?? "").trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1) text = text.slice(first, last + 1);

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      overall: 7,
      mobile_readability: 7,
      visual_clarity: 7,
      hook_strength: 7,
      cta_fit: 7,
      source_confidence: 7,
      export_readiness: 7,
      notes: ["Could not parse scorer output."],
    };
  }

  const clip = (n: any) => Math.max(0, Math.min(10, Number(n) || 0));
  const sub = {
    mobile_readability: clip(parsed.mobile_readability),
    visual_clarity: clip(parsed.visual_clarity),
    hook_strength: clip(parsed.hook_strength),
    cta_fit: clip(parsed.cta_fit),
    source_confidence: clip(parsed.source_confidence),
    export_readiness: clip(parsed.export_readiness),
  };
  const overall =
    (sub.mobile_readability +
      sub.visual_clarity +
      sub.hook_strength +
      sub.cta_fit +
      sub.source_confidence +
      sub.export_readiness) /
    6;

  return {
    overall: Math.round(overall * 10) / 10,
    ...sub,
    notes: Array.isArray(parsed.notes) ? parsed.notes.slice(0, 4).map((n: any) => String(n)) : [],
  };
}
