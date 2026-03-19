import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

    // Get post_id from request body
    const { post_id } = await req.json();
    if (!post_id) throw new Error("post_id is required");

    // Fetch the post
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("*")
      .eq("id", post_id)
      .single();

    if (postError || !post) throw new Error("Post not found");
    if (post.status !== "approved") throw new Error("Post must be approved before publishing");

    // Fetch LinkedIn access token from settings
    const { data: tokenSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "linkedin_access_token")
      .single();

    const accessToken = tokenSetting?.value;
    if (!accessToken) throw new Error("LinkedIn access token not configured. Go to Settings to add it.");

    // Post to LinkedIn API v2 (ugcPosts)
    // Note: You need your LinkedIn Person URN. We'll fetch it from the token.
    // First get the user's profile to get the person URN
    const profileRes = await fetch("https://api.linkedin.com/v2/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileRes.ok) {
      const errText = await profileRes.text();
      throw new Error(`LinkedIn profile fetch failed: ${errText}`);
    }

    const profile = await profileRes.json();
    const personUrn = `urn:li:person:${profile.id}`;

    // Create the LinkedIn post
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
      throw new Error(`LinkedIn publish failed [${linkedinRes.status}]: ${errText}`);
    }

    const linkedinData = await linkedinRes.json();

    // Update post status
    const now = new Date().toISOString();
    await supabase
      .from("posts")
      .update({ status: "published", published_at: now })
      .eq("id", post_id);

    // Log to agent_log
    await supabase.from("agent_log").insert({
      action: "linkedin_published",
      api_cost_usd: 0,
      tokens_used: 0,
      details: {
        post_id,
        linkedin_id: linkedinData.id,
        published_at: now,
      },
    });

    return new Response(
      JSON.stringify({ status: "success", post_id, linkedin_id: linkedinData.id }),
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
