import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { sanitizeForLinkedIn } from "../_shared/linkedin-sanitize.ts";
import { postFirstComment } from "../_shared/linkedin-first-comment.ts";
import { ensureScorecard, normaliseScorecardUrl, SCORECARD_URL } from "../_shared/scorecard.ts";




const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const normalizeToken = (raw: string | null | undefined) => {
  if (!raw) return "";
  const trimmed = raw.trim().replace(/^"|"$/g, "");
  return trimmed.startsWith("Bearer ") ? trimmed.slice(7).trim() : trimmed;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { post_id } = await req.json();
    if (!post_id) throw new Error("post_id is required");

    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("*")
      .eq("id", post_id)
      .single();

    if (postError || !post) throw new Error("Post not found");
    if (post.status !== "approved") throw new Error("Post must be approved before publishing");

    const { data: tokenSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "linkedin_access_token")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const accessToken = normalizeToken(tokenSetting?.value);
    if (!accessToken) throw new Error("LinkedIn access token not configured. Go to Settings to add it.");

    const personUrn = "urn:li:person:1Ov50zK-3L";
    console.log("Publishing with person URN:", personUrn);

    // Final scorecard safety net before publishing — guarantees the URL exists in body or first comment.
    const ensured = ensureScorecard(post.content, post.first_comment_text, "soft");
    if (ensured.body !== post.content || ensured.firstComment !== post.first_comment_text) {
      await supabase.from("posts").update({
        content: ensured.body,
        first_comment_text: ensured.firstComment,
      }).eq("id", post_id);
      post.content = ensured.body;
      post.first_comment_text = ensured.firstComment;
    }

    const { sanitizedText: sanitizedContent, diagnostics: sanitizeDiagnostics } = sanitizeForLinkedIn(ensured.body);

    // UGC Posts API payload
    const linkedinUrl = "https://api.linkedin.com/v2/ugcPosts";
    const linkedinRequestHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
      "X-Restli-Protocol-Version": "2.0.0",
    };
    const linkedinRequestBody = {
      author: personUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: sanitizedContent,
          },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    const serializedLinkedinBody = JSON.stringify(linkedinRequestBody);

    console.log("LinkedIn UGC API request", {
      url: linkedinUrl,
      method: "POST",
      headers: linkedinRequestHeaders,
      body: linkedinRequestBody,
    });

    console.log("LinkedIn payload diagnostics", {
      post_content_length: post.content.length,
      sanitized_content_length: sanitizedContent.length,
      non_ascii_removed_count: sanitizeDiagnostics.nonAsciiRemovedCount,
      first_removed_hex_codes: sanitizeDiagnostics.firstRemovedHexCodes,
      request_json_length: serializedLinkedinBody.length,
      content_first_50: sanitizedContent.slice(0, 50),
      content_last_50: sanitizedContent.slice(-50),
    });
    console.log("LinkedIn UGC payload JSON string", serializedLinkedinBody);

    const linkedinRes = await fetch(linkedinUrl, {
      method: "POST",
      headers: linkedinRequestHeaders,
      body: serializedLinkedinBody,
    });

    const linkedinText = await linkedinRes.text();
    const linkedinResponseHeaders: Record<string, string> = {};
    linkedinRes.headers.forEach((v, k) => {
      linkedinResponseHeaders[k] = v;
    });

    console.log("LinkedIn UGC API response", {
      status: linkedinRes.status,
      headers: linkedinResponseHeaders,
      body: linkedinText,
    });

    if (!linkedinRes.ok) {
      throw new Error(`LinkedIn UGC publish failed [${linkedinRes.status}]: ${linkedinText}`);
    }

    // UGC API returns the ID in the response body
    let linkedinId: string | null = null;
    try {
      const parsed = JSON.parse(linkedinText);
      linkedinId = parsed.id || null;
    } catch {
      linkedinId = linkedinRes.headers.get("x-restli-id") || null;
    }

    const now = new Date().toISOString();
    await supabase.from("posts").update({
      status: "published",
      published_at: now,
      linkedin_urn: linkedinId,
    }).eq("id", post_id);

    // ===== Auto first-comment with lead-magnet CTA =====
    let firstCommentResult: Record<string, unknown> | null = null;
    if (linkedinId && post.first_comment_text) {
      const { data: ceoCtx } = await supabase
        .from("ceo_context").select("auto_first_comment, lead_magnet_url").limit(1).maybeSingle();
      const autoEnabled = ceoCtx?.auto_first_comment !== false;
      if (autoEnabled) {
        const commentText = normaliseScorecardUrl(
          post.first_comment_text.includes(SCORECARD_URL)
            ? post.first_comment_text
            : `${post.first_comment_text}\n${SCORECARD_URL}`,
        );
        try {
          const c = await postFirstComment({
            accessToken, personUrn, shareUrn: linkedinId, text: commentText,
          });
          firstCommentResult = { status: c.status, ok: c.ok, comment_urn: c.commentUrn };
          if (c.ok) {
            await supabase.from("posts").update({ first_comment_posted_at: now }).eq("id", post_id);
          } else {
            console.error("First-comment failed", c.status, c.body);
          }
        } catch (e) {
          firstCommentResult = { status: 0, ok: false, error: String(e) };
          console.error("First-comment threw:", e);
        }
      }
    }

    await supabase.from("agent_log").insert({
      action: "linkedin_published_ugc",
      api_cost_usd: 0,
      tokens_used: 0,
      details: { post_id, linkedin_id: linkedinId, published_at: now, resolved_urn: personUrn, api: "ugcPosts", first_comment: firstCommentResult },
    });

    return new Response(
      JSON.stringify({ status: "success", post_id, linkedin_id: linkedinId, resolved_urn: personUrn, api: "ugcPosts" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("publish-to-linkedin error:", e);
    return new Response(
      JSON.stringify({ status: "error", error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});