// Client mirror of supabase/functions/_shared/scorecard.ts
import type { Post } from "@/types/database";

export const SCORECARD_URL = "https://build.londonra.com";

export const DEFAULT_SOFT_CTA =
  `If you want to see how ready your business actually is for AI, the Build to Certify scorecard takes 4 minutes: ${SCORECARD_URL}`;

export function normaliseScorecardUrl(text: string | null | undefined): string {
  if (!text) return text ?? "";
  let out = text;
  out = out.replace(/https?:\/\/build\.londonra\.com\b/gi, SCORECARD_URL);
  out = out.replace(/(?<![\/.\w])build\.londonra\.com\b/gi, SCORECARD_URL);
  out = out.replace(/https:\/\/https:\/\//gi, "https://");
  return out;
}

export type ScorecardStatus = {
  ok: boolean;
  location: "body" | "first_comment" | "missing";
  /** human label for UI badges */
  label: string;
};

export function detectScorecard(post: Pick<Post, "content" | "first_comment_text">): ScorecardStatus {
  const bodyHas = !!post.content && post.content.includes(SCORECARD_URL);
  const commentHas = !!post.first_comment_text && post.first_comment_text.includes(SCORECARD_URL);
  if (bodyHas) return { ok: true, location: "body", label: "in body" };
  if (commentHas) return { ok: true, location: "first_comment", label: "first comment" };
  // Also accept the bare form so badges don't lie before normalisation runs.
  const bodyBare = !!post.content && /build\.londonra\.com/i.test(post.content);
  const commentBare = !!post.first_comment_text && /build\.londonra\.com/i.test(post.first_comment_text);
  if (bodyBare) return { ok: true, location: "body", label: "in body" };
  if (commentBare) return { ok: true, location: "first_comment", label: "first comment" };
  return { ok: false, location: "missing", label: "missing" };
}
