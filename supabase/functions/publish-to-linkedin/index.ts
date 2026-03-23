import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { sanitizeForLinkedIn } from "../_shared/linkedin-sanitize.ts";

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

/** Resolve the author URN directly from the access token via LinkedIn APIs. */
async function resolvePersonUrn(accessToken: string): Promise<string> {
  // Try /v2/userinfo first (OpenID Connect — returns 'sub' field)
  try {
    const userinfoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const userinfoText = await userinfoRes.text();
    console.log("GET /v2/userinfo response", { status: userinfoRes.status, body: userinfoText });

    if (userinfoRes.ok) {
      const data = JSON.parse(userinfoText);
      if (data.sub) {
        const urn = `urn:li:person:${data.sub}`;
        console.log("Resolved person URN from /v2/userinfo:", urn);
        return urn;
      }
    }
  } catch (err) {
    console.warn("/v2/userinfo failed:", err);
  }

  // Fallback: /v2/me
  try {
    const meRes = await fetch("https://api.linkedin.com/v2/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const meText = await meRes.text();
    console.log("GET /v2/me response", { status: meRes.status, body: meText });

    if (meRes.ok) {
      const data = JSON.parse(meText);
      if (data.id) {
        const urn = `urn:li:person:${data.id}`;
        console.log("Resolved person URN from /v2/me:", urn);
        return urn;
      }
    }
  } catch (err) {
    console.warn("/v2/me failed:", err);
  }

  return "";
}

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

    // Always resolve person URN from the token itself to prevent mismatches
    let personUrn = await resolvePersonUrn(accessToken);

    // Fallback to stored URN only if API resolution fails entirely
    if (!personUrn) {
      const { data: urnSetting } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "linkedin_person_urn")
        .maybeSingle();
      personUrn = urnSetting?.value?.trim() || Deno.env.get("LINKEDIN_PERSON_URN") || "";
      console.warn("Could not resolve URN from token — falling back to stored URN:", personUrn);
    }

    if (!personUrn) throw new Error("LinkedIn person URN could not be resolved. Go to Settings to add it.");

    console.log("Publishing with person URN:", personUrn);

    const sanitizedContent = sanitizeForLinkedIn(post.content);

    // Create post using LinkedIn Posts API
    const linkedinUrl = "https://api.linkedin.com/rest/posts";
    const linkedinRequestHeaders = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
      "LinkedIn-Version": "202503",
      "X-Restli-Protocol-Version": "2.0.0",
    };
    const linkedinRequestBody = {
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
    };

    const serializedLinkedinBody = JSON.stringify(linkedinRequestBody);

    console.log("LinkedIn API request", {
      url: linkedinUrl,
      method: "POST",
      headers: linkedinRequestHeaders,
      body: linkedinRequestBody,
    });

    console.log("LinkedIn payload diagnostics", {
      post_content_length: post.content.length,
      sanitized_content_length: sanitizedContent.length,
      request_json_length: serializedLinkedinBody.length,
      content_first_50: sanitizedContent.slice(0, 50),
      content_last_50: sanitizedContent.slice(-50),
    });
    console.log("LinkedIn payload JSON string", serializedLinkedinBody);

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

    console.log("LinkedIn API response", {
      status: linkedinRes.status,
      headers: linkedinResponseHeaders,
      body: linkedinText,
    });

    if (!linkedinRes.ok) {
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
      details: { post_id, linkedin_id: linkedinId, published_at: now, resolved_urn: personUrn },
    });

    return new Response(
      JSON.stringify({ status: "success", post_id, linkedin_id: linkedinId, resolved_urn: personUrn }),
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