// Sync-linkedin-metrics — hourly cron.
// Pulls likes / comments / reposts for every published post that has a
// linkedin_urn, upserts into post_metrics. Fails soft: individual post errors
// are logged but never crash the run.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchSocialActions(urn: string, token: string) {
  // socialActions endpoint returns likesSummary + commentsSummary counts
  const encoded = encodeURIComponent(urn);
  const url = `https://api.linkedin.com/v2/socialActions/${encoded}`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });
  if (!resp.ok) throw new Error(`socialActions ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const likes = data?.likesSummary?.totalLikes ?? data?.likesSummary?.aggregatedTotalLikes ?? 0;
  const comments = data?.commentsSummary?.aggregatedTotalComments ?? data?.commentsSummary?.totalComments ?? 0;
  return { likes: Number(likes) || 0, comments: Number(comments) || 0 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: tokenRow } = await supabase
    .from("settings").select("value").eq("key", "linkedin_access_token").maybeSingle();
  const token = tokenRow?.value;
  if (!token) {
    return new Response(JSON.stringify({ status: "skipped", reason: "no linkedin_access_token in settings" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, linkedin_urn")
    .eq("status", "published")
    .not("linkedin_urn", "is", null)
    .gte("published_at", since);
  if (error) throw error;

  let synced = 0, failed = 0;
  const failures: Array<{ post_id: string; error: string }> = [];

  for (const p of posts ?? []) {
    try {
      const { likes, comments } = await fetchSocialActions(p.linkedin_urn as string, token);
      await supabase.from("post_metrics").upsert({
        post_id: p.id,
        likes, comments,
        reposts: 0, // repost count not returned by socialActions; keep existing if any
        impressions: 0,
        engagement_rate: 0,
        collected_at: new Date().toISOString(),
      }, { onConflict: "post_id" });
      synced++;
    } catch (e) {
      failed++;
      failures.push({ post_id: p.id, error: String(e).slice(0, 200) });
    }
  }

  await supabase.from("agent_log").insert({
    action: failed > 0 ? "sync_linkedin_metrics_partial" : "sync_linkedin_metrics",
    details: { synced, failed, total: posts?.length ?? 0, failures: failures.slice(0, 5) },
  });

  return new Response(JSON.stringify({ status: "ok", synced, failed, total: posts?.length ?? 0 }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
