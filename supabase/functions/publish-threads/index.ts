// Publish an approved Threads variant via Meta Threads Graph API.
// Two-step: create a media container, then publish it.
// Requires THREADS_ACCESS_TOKEN (long-lived) + THREADS_USER_ID.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH = "https://graph.threads.net/v1.0";
const MAX = 500;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = Deno.env.get("THREADS_ACCESS_TOKEN");
  const userId = Deno.env.get("THREADS_USER_ID");
  if (!token || !userId) {
    return new Response(JSON.stringify({ error: "Missing THREADS_ACCESS_TOKEN or THREADS_USER_ID" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* ok */ }
  let q = supabase.from("channel_variants").select("*").eq("channel", "threads").eq("status", "approved");
  if (body.variant_id) q = q.eq("id", body.variant_id);
  const { data: variants } = await q.limit(5);
  if (!variants?.length) {
    return new Response(JSON.stringify({ published: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const results: any[] = [];
  for (const v of variants) {
    try {
      const text = v.variant_text.length > MAX ? v.variant_text.slice(0, MAX - 1) + "…" : v.variant_text;
      // 1. create container
      const createUrl = `${GRAPH}/${userId}/threads?media_type=TEXT&text=${encodeURIComponent(text)}&access_token=${token}`;
      const c = await fetch(createUrl, { method: "POST" });
      if (!c.ok) throw new Error(`create [${c.status}]: ${await c.text()}`);
      const { id: containerId } = await c.json();
      // 2. publish
      const pubUrl = `${GRAPH}/${userId}/threads_publish?creation_id=${containerId}&access_token=${token}`;
      const p = await fetch(pubUrl, { method: "POST" });
      if (!p.ok) throw new Error(`publish [${p.status}]: ${await p.text()}`);
      const { id: mediaId } = await p.json();
      const url = `https://www.threads.net/@_/post/${mediaId}`;
      await supabase.from("channel_variants").update({
        status: "published", external_url: url, published_at: new Date().toISOString(),
      }).eq("id", v.id);
      results.push({ variant_id: v.id, status: "published", url });
    } catch (e) {
      console.error("publish-threads failed:", e);
      results.push({ variant_id: v.id, status: "failed", error: String(e) });
    }
  }

  await supabase.from("agent_log").insert({
    action: "publish_threads", api_cost_usd: 0, tokens_used: 0, details: { results },
  });

  return new Response(JSON.stringify({ published: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
