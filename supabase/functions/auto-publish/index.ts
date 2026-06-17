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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if auto-publish is enabled
    const { data: autoSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "auto_publish_enabled")
      .single();

    if (autoSetting?.value !== "true") {
      return new Response(
        JSON.stringify({ status: "skipped", reason: "Auto-publish is disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const currentTime = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}:00`;

    const { data: approvedPosts } = await supabase
      .from("posts")
      .select("*")
      .eq("status", "approved")
      .lte("suggested_time", currentTime);

    if (!approvedPosts || approvedPosts.length === 0) {
      return new Response(
        JSON.stringify({ status: "skipped", reason: "No posts ready to publish" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get LinkedIn token
    const { data: tokenSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "linkedin_access_token")
      .single();

    const accessToken = tokenSetting?.value?.trim();
    if (!accessToken) {
      return new Response(
        JSON.stringify({ status: "error", error: "LinkedIn access token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get person URN from settings or env
    const { data: urnSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "linkedin_person_urn")
      .maybeSingle();

    const personUrn = urnSetting?.value?.trim() || Deno.env.get("LINKEDIN_PERSON_URN") || "";
    if (!personUrn) {
      return new Response(
        JSON.stringify({ status: "error", error: "LinkedIn person URN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load CEO context once — used for auto-first-comment defaults
    const { data: ceoCtx } = await supabase
      .from("ceo_context").select("auto_first_comment, lead_magnet_url").limit(1).maybeSingle();
    const autoFirstComment = ceoCtx?.auto_first_comment !== false;
    const leadMagnetUrl = ceoCtx?.lead_magnet_url || "https://build.londonra.com";

    const results = [];

    for (const post of approvedPosts) {
      try {
        // Zero-fabrication guard: never auto-publish a draft that hasn't passed the verifier.
        if (post.verification_status !== "passed") {
          console.warn(`Skipping auto-publish for post ${post.id} — verification_status=${post.verification_status}`);
          await supabase.from("agent_log").insert({
            action: "auto_publish_skipped_verification",
            api_cost_usd: 0,
            tokens_used: 0,
            details: {
              post_id: post.id,
              verification_status: post.verification_status,
              reason: "Post not auto-published because the fact-check did not pass; needs manual review.",
            },
          });
          results.push({ post_id: post.id, status: "skipped_verification", verification_status: post.verification_status });
          continue;
        }

        // Engagement gate: only the strongest drafts auto-publish.
        if (post.engagement_estimate !== "high") {
          console.warn(`Skipping auto-publish for post ${post.id} — engagement_estimate=${post.engagement_estimate}`);
          await supabase.from("agent_log").insert({
            action: "auto_publish_skipped_low_engagement",
            api_cost_usd: 0,
            tokens_used: 0,
            details: {
              post_id: post.id,
              engagement_estimate: post.engagement_estimate,
              virality_score: post.virality_score,
              reason: "Post held back from auto-publish — engagement estimate is not 'high'. Needs manual review.",
            },
          });
          results.push({ post_id: post.id, status: "skipped_low_engagement", engagement_estimate: post.engagement_estimate });
          continue;
        }

        // Final scorecard safety net — never publish without the canonical URL.
        const ensured = ensureScorecard(post.content, post.first_comment_text, "soft");
        const { sanitizedText: sanitizedContent, diagnostics: sanitizeDiagnostics } = sanitizeForLinkedIn(ensured.body);

        console.log("Auto-publish sanitization diagnostics", {
          post_id: post.id,
          original_content_length: sanitizeDiagnostics.originalLength,
          sanitized_content_length: sanitizeDiagnostics.sanitizedLength,
          non_ascii_removed_count: sanitizeDiagnostics.nonAsciiRemovedCount,
          first_removed_hex_codes: sanitizeDiagnostics.firstRemovedHexCodes,
          scorecard_added: ensured.added,
          scorecard_location: ensured.location,
        });

        const linkedinRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=utf-8",
            "X-Restli-Protocol-Version": "2.0.0",
          },
          body: JSON.stringify({
            author: personUrn,
            lifecycleState: "PUBLISHED",
            specificContent: {
              "com.linkedin.ugc.ShareContent": {
                shareCommentary: { text: sanitizedContent },
                shareMediaCategory: "NONE",
              },
            },
            visibility: {
              "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
            },
          }),
        });

        if (!linkedinRes.ok) {
          const errText = await linkedinRes.text();
          console.error(`Failed to publish post ${post.id}:`, errText);
          results.push({ post_id: post.id, status: "failed", error: errText });
          continue;
        }

        const linkedinId = linkedinRes.headers.get("x-restli-id") || null;
        const publishedAt = new Date().toISOString();

        await supabase.from("posts").update({
          status: "published",
          published_at: publishedAt,
          content: ensured.body,
          first_comment_text: ensured.firstComment,
        }).eq("id", post.id);

        // Auto first-comment with lead-magnet CTA, normalised to canonical URL.
        const effectiveFirstComment = ensured.firstComment;

        let firstCommentResult: Record<string, unknown> | null = null;
        if (autoFirstComment && linkedinId && effectiveFirstComment) {
          const commentText = normaliseScorecardUrl(
            effectiveFirstComment.includes(SCORECARD_URL)
              ? effectiveFirstComment
              : `${effectiveFirstComment}\n${SCORECARD_URL}`,
          );
          try {
            const c = await postFirstComment({
              accessToken, personUrn, shareUrn: linkedinId, text: commentText,
            });
            firstCommentResult = { status: c.status, ok: c.ok, comment_urn: c.commentUrn };
            if (c.ok) {
              await supabase.from("posts").update({ first_comment_posted_at: publishedAt, first_comment_text: commentText }).eq("id", post.id);
            } else {
              console.error("Auto first-comment failed", c.status, c.body);
            }
          } catch (e) {
            firstCommentResult = { status: 0, ok: false, error: String(e) };
            console.error("Auto first-comment threw:", e);
          }
        }


        await supabase.from("agent_log").insert({
          action: "auto_published",
          api_cost_usd: 0,
          tokens_used: 0,
          details: { post_id: post.id, linkedin_id: linkedinId, published_at: publishedAt, first_comment: firstCommentResult },
        });

        results.push({ post_id: post.id, status: "published", linkedin_id: linkedinId, first_comment: firstCommentResult });
      } catch (err) {
        console.error(`Error publishing post ${post.id}:`, err);
        results.push({ post_id: post.id, status: "failed", error: String(err) });
      }
    }

    return new Response(
      JSON.stringify({ status: "success", results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("auto-publish error:", e);
    return new Response(
      JSON.stringify({ status: "error", error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});