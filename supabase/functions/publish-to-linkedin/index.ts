import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

    // Fetch the post
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("*")
      .eq("id", post_id)
      .single();

    if (postError || !post) throw new Error("Post not found");
    if (post.status !== "approved") throw new Error("Post must be approved before publishing");

    // Fetch LinkedIn access token
    const { data: tokenSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "linkedin_access_token")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const accessToken = normalizeToken(tokenSetting?.value);
    if (!accessToken) throw new Error("LinkedIn access token not configured. Go to Settings to add it.");

    // Resolve person URN: settings table first, then env var fallback
    const { data: urnSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "linkedin_person_urn")
      .maybeSingle();

    const personUrn = urnSetting?.value?.trim() || Deno.env.get("LINKEDIN_PERSON_URN") || "";
    if (!personUrn) throw new Error("LinkedIn person URN not configured. Go to Settings to add it.");

    console.log("Publishing with person URN:", personUrn);

    // Create post using LinkedIn Posts API
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
        commentary: post.content,
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

    const linkedinText = await linkedinRes.text();

    if (!linkedinRes.ok) {
      console.error("LinkedIn publish failed", { status: linkedinRes.status, body: linkedinText });
      throw new Error(`LinkedIn publish failed [${linkedinRes.status}]: ${linkedinText}`);
    }

    const linkedinId = linkedinRes.headers.get("x-restli-id") || null;

    // Update post status
    const now = new Date().toISOString();
    await supabase.from("posts").update({ status: "published", published_at: now }).eq("id", post_id);

    await supabase.from("agent_log").insert({
      action: "linkedin_published",
      api_cost_usd: 0,
      tokens_used: 0,
      details: { post_id, linkedin_id: linkedinId, published_at: now },
    });

    return new Response(
      JSON.stringify({ status: "success", post_id, linkedin_id: linkedinId }),
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
