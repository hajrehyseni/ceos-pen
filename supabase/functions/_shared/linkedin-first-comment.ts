import { sanitizeForLinkedIn } from "./linkedin-sanitize.ts";

/**
 * Posts the first comment on a freshly-published LinkedIn UGC post.
 * Returns { ok, status, body, commentUrn } — never throws; callers log + continue.
 *
 * LinkedIn API: POST /v2/socialActions/{shareUrn}/comments
 * The shareUrn must be URL-encoded in the path.
 */
export async function postFirstComment(args: {
  accessToken: string;
  personUrn: string;
  shareUrn: string; // e.g. "urn:li:share:7280..." or "urn:li:ugcPost:..."
  text: string;
}): Promise<{ ok: boolean; status: number; body: string; commentUrn: string | null }> {
  const { accessToken, personUrn, shareUrn, text } = args;
  const { sanitizedText } = sanitizeForLinkedIn(text);
  const url = `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(shareUrn)}/comments`;
  const body = JSON.stringify({
    actor: personUrn,
    object: shareUrn,
    message: { text: sanitizedText },
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body,
  });
  const respText = await resp.text();
  let commentUrn: string | null = null;
  try {
    const parsed = JSON.parse(respText);
    commentUrn = parsed?.["$URN"] ?? parsed?.id ?? null;
  } catch {
    // non-JSON response (e.g. error HTML) — leave commentUrn null
  }
  return { ok: resp.ok, status: resp.status, body: respText, commentUrn };
}
