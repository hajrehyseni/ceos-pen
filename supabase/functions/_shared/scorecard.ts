// Shared scorecard guarantee — used by generate-draft, auto-publish, publish-to-linkedin.
// Every CEO Pen post MUST carry the full Build to Certify URL either in body or first comment.

export const SCORECARD_URL = "https://build.londonra.com";

export const DEFAULT_SOFT_CTA =
  `If you want to see how ready your business actually is for AI, the Build to Certify scorecard takes 4 minutes: ${SCORECARD_URL}`;

export const DEFAULT_HARD_CTA =
  `If you want to see how ready your business actually is for AI, the Build to Certify scorecard takes 4 minutes: ${SCORECARD_URL}`;

/**
 * Promote any bare or http reference of build.londonra.com to the canonical
 * https:// form. Idempotent — running twice will not produce https://https://.
 */
export function normaliseScorecardUrl(text: string | null | undefined): string {
  if (!text) return text ?? "";
  let out = text;
  // First, collapse any http(s)://build.londonra.com to the canonical URL.
  out = out.replace(/https?:\/\/build\.londonra\.com\b/gi, SCORECARD_URL);
  // Then upgrade bare build.londonra.com (no protocol) to the canonical URL,
  // but only when it's not already preceded by the canonical URL we just wrote.
  out = out.replace(/(?<![\/.\w])build\.londonra\.com\b/gi, SCORECARD_URL);
  // Collapse any accidental double protocol (defensive).
  out = out.replace(/https:\/\/https:\/\//gi, "https://");
  return out;
}

export type CtaMode = "hard" | "soft";

export interface ScorecardEnsureResult {
  body: string;
  firstComment: string | null;
  added: "none" | "body" | "first_comment";
  location: "body" | "first_comment";
}

/**
 * Guarantee the scorecard link lives in either body or first_comment.
 * Run AFTER all generation/sanitisation, BEFORE persisting or publishing.
 */
export function ensureScorecard(
  body: string,
  firstComment: string | null,
  ctaMode: CtaMode,
): ScorecardEnsureResult {
  const cleanBody = normaliseScorecardUrl(body);
  const cleanComment = normaliseScorecardUrl(firstComment);

  const inBody = cleanBody.includes(SCORECARD_URL);
  const inComment = !!cleanComment && cleanComment.includes(SCORECARD_URL);

  if (inBody) {
    return { body: cleanBody, firstComment: cleanComment || null, added: "none", location: "body" };
  }
  if (inComment) {
    return { body: cleanBody, firstComment: cleanComment, added: "none", location: "first_comment" };
  }

  // Neither has it — inject default per mode.
  if (ctaMode === "hard") {
    return {
      body: `${cleanBody.trim()}\n\n${DEFAULT_HARD_CTA}`,
      firstComment: cleanComment || null,
      added: "body",
      location: "body",
    };
  }
  return {
    body: cleanBody,
    firstComment: DEFAULT_SOFT_CTA,
    added: "first_comment",
    location: "first_comment",
  };
}
