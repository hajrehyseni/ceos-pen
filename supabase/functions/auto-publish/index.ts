import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const linkedInVersionHeaders = {
  "LinkedIn-Version": "202401",
  "X-Restli-Protocol-Version": "2.0.0",
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

    // Get current UTC time
    const now = new Date();
    const currentTime = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}:00`;

    // Fetch approved posts where suggested_time has passed
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

    const accessToken = tokenSetting?.value;
    if (!accessToken) {
      return new Response(
        JSON.stringify({ status: "error", error: "LinkedIn access token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get person URN
    const profileRes = await fetch("https://api.linkedin.com/v2/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...linkedInVersionHeaders,
      },
    });
    if (!profileRes.ok) throw new Error("Failed to fetch LinkedIn profile");
    const profile = await profileRes.json();
    const personUrn = `urn:li:person:${profile.id}`;

    const results = [];

    for (const post of approvedPosts) {
      try {
        const linkedinRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
          },
          body: JSON.stringify({
            author: personUrn,
            lifecycleState: "PUBLISHED",
            specificContent: {
              "com.linkedin.ugc.ShareContent": {
                shareCommentary: { text: post.content },
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

        const linkedinData = await linkedinRes.json();
        const publishedAt = new Date().toISOString();

        await supabase
          .from("posts")
          .update({ status: "published", published_at: publishedAt })
          .eq("id", post.id);

        await supabase.from("agent_log").insert({
          action: "auto_published",
          api_cost_usd: 0,
          tokens_used: 0,
          details: {
            post_id: post.id,
            linkedin_id: linkedinData.id,
            published_at: publishedAt,
          },
        });

        results.push({ post_id: post.id, status: "published", linkedin_id: linkedinData.id });
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
