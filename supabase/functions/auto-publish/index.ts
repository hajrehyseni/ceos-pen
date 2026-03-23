import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { sanitizeForLinkedIn } from "../_shared/linkedin-sanitize.ts";

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

    const results = [];

    for (const post of approvedPosts) {
      try {
        const { sanitizedText: sanitizedContent, diagnostics: sanitizeDiagnostics } = sanitizeForLinkedIn(post.content);

        console.log("Auto-publish sanitization diagnostics", {
          post_id: post.id,
          original_content_length: sanitizeDiagnostics.originalLength,
          sanitized_content_length: sanitizeDiagnostics.sanitizedLength,
          non_ascii_removed_count: sanitizeDiagnostics.nonAsciiRemovedCount,
          first_removed_hex_codes: sanitizeDiagnostics.firstRemovedHexCodes,
        });

        const linkedinRes = await fetch("https://api.linkedin.com/rest/posts", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "LinkedIn-Version": "202503",
            "X-Restli-Protocol-Version": "2.0.0",
          },
          body: JSON.stringify({
            author: personUrn,
            commentary: sanitizedContent,
            visibility: "PUBLIC",
            distribution: {
              feedDistribution: "MAIN_FEED",
              targetEntities: [],
              thirdPartyDistributionChannels: [],
            },
            lifecycleState: "PUBLISHED",
            isReshareDisabledByAuthor: false,
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

        await supabase.from("posts").update({ status: "published", published_at: publishedAt }).eq("id", post.id);

        await supabase.from("agent_log").insert({
          action: "auto_published",
          api_cost_usd: 0,
          tokens_used: 0,
          details: { post_id: post.id, linkedin_id: linkedinId, published_at: publishedAt },
        });

        results.push({ post_id: post.id, status: "published", linkedin_id: linkedinId });
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