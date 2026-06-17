// Harvest top-performing published posts into voice_samples so the
// generator self-trains on what actually worked.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look at posts published 3-60 days ago (long enough to settle, fresh enough to matter)
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const { data: publishedPosts, error: postsErr } = await supabase
      .from("posts")
      .select("id, content, pillar, published_at")
      .eq("status", "published")
      .lte("published_at", threeDaysAgo)
      .gte("published_at", sixtyDaysAgo);
    if (postsErr) throw new Error(`fetch posts: ${postsErr.message}`);
    if (!publishedPosts || publishedPosts.length === 0) {
      return new Response(JSON.stringify({ status: "success", harvested: 0, reason: "no eligible posts" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = publishedPosts.map((p) => p.id);
    const { data: metricsRows } = await supabase
      .from("post_metrics")
      .select("post_id, likes, comments, reposts")
      .in("post_id", ids);

    const scoreByPost = new Map<string, number>();
    (metricsRows ?? []).forEach((m: any) => {
      const s = (m.likes ?? 0) + 3 * (m.comments ?? 0) + 2 * (m.reposts ?? 0);
      // keep the highest snapshot per post
      scoreByPost.set(m.post_id, Math.max(scoreByPost.get(m.post_id) ?? 0, s));
    });

    const scored = publishedPosts
      .map((p) => ({ ...p, engagement: scoreByPost.get(p.id) ?? 0 }))
      .filter((p) => p.engagement > 0)
      .sort((a, b) => b.engagement - a.engagement);

    if (scored.length === 0) {
      return new Response(JSON.stringify({ status: "success", harvested: 0, reason: "no engagement data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rolling median × 1.5 threshold
    const sortedAsc = [...scored].map((s) => s.engagement).sort((a, b) => a - b);
    const median = sortedAsc[Math.floor(sortedAsc.length / 2)];
    const threshold = Math.max(median * 1.5, 5);

    const winners = scored.filter((p) => p.engagement >= threshold);

    // Avoid re-harvesting the same post
    const { data: alreadyHarvested } = await supabase
      .from("voice_samples")
      .select("source_post_id")
      .not("source_post_id", "is", null);
    const harvestedIds = new Set((alreadyHarvested ?? []).map((r: any) => r.source_post_id));

    const toInsert = winners
      .filter((w) => !harvestedIds.has(w.id))
      .map((w) => ({
        content: w.content,
        performance_rating: 9,
        notes: `Auto-harvested winner — engagement ${w.engagement} (threshold ${Math.round(threshold)})`,
        auto_harvested: true,
        style_tags: [w.pillar].filter(Boolean),
        source_post_id: w.id,
      }));

    let inserted = 0;
    if (toInsert.length > 0) {
      const { error: insErr, count } = await supabase
        .from("voice_samples")
        .insert(toInsert, { count: "exact" });
      if (insErr) throw new Error(`insert voice_samples: ${insErr.message}`);
      inserted = count ?? toInsert.length;
    }

    await supabase.from("agent_log").insert({
      action: "winners_harvested",
      api_cost_usd: 0,
      tokens_used: 0,
      details: {
        eligible_posts: publishedPosts.length,
        winners_found: winners.length,
        already_harvested: winners.length - toInsert.length,
        newly_harvested: inserted,
        median_engagement: median,
        threshold,
      },
    });

    return new Response(
      JSON.stringify({ status: "success", harvested: inserted, threshold, median }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("harvest-winners error:", e);
    return new Response(
      JSON.stringify({ status: "error", error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
