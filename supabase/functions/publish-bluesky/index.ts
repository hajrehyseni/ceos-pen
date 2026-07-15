// Publish an approved Bluesky variant via AT Protocol.
// Auth: BLUESKY_HANDLE (e.g. "hajra.bsky.social") + BLUESKY_APP_PASSWORD.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PDS = "https://bsky.social/xrpc";
const MAX = 300;

async function login(handle: string, appPassword: string) {
  const r = await fetch(`${PDS}/com.atproto.server.createSession`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: handle, password: appPassword }),
  });
  if (!r.ok) throw new Error(`Bluesky login [${r.status}]: ${await r.text()}`);
  return r.json() as Promise<{ accessJwt: string; did: string }>;
}

async function createPost(accessJwt: string, did: string, text: string) {
  const r = await fetch(`${PDS}/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessJwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      repo: did, collection: "app.bsky.feed.post",
      record: { $type: "app.bsky.feed.post", text, createdAt: new Date().toISOString() },
    }),
  });
  if (!r.ok) throw new Error(`Bluesky post [${r.status}]: ${await r.text()}`);
  return r.json() as Promise<{ uri: string; cid: string }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const handle = Deno.env.get("BLUESKY_HANDLE");
  const appPw = Deno.env.get("BLUESKY_APP_PASSWORD");
  if (!handle || !appPw) {
    return new Response(JSON.stringify({ error: "Missing BLUESKY_HANDLE or BLUESKY_APP_PASSWORD" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* ok */ }
  let q = supabase.from("channel_variants").select("*").eq("channel", "bluesky").eq("status", "approved");
  if (body.variant_id) q = q.eq("id", body.variant_id);
  const { data: variants } = await q.limit(5);
  if (!variants?.length) {
    return new Response(JSON.stringify({ published: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const session = await login(handle, appPw);
  const results: any[] = [];
  for (const v of variants) {
    try {
      const text = v.variant_text.length > MAX ? v.variant_text.slice(0, MAX - 1) + "…" : v.variant_text;
      const post = await createPost(session.accessJwt, session.did, text);
      const rkey = post.uri.split("/").pop();
      const url = `https://bsky.app/profile/${handle}/post/${rkey}`;
      await supabase.from("channel_variants").update({
        status: "published", external_url: url, published_at: new Date().toISOString(),
      }).eq("id", v.id);
      results.push({ variant_id: v.id, status: "published", url });
    } catch (e) {
      console.error("publish-bluesky failed:", e);
      results.push({ variant_id: v.id, status: "failed", error: String(e) });
    }
  }

  await supabase.from("agent_log").insert({
    action: "publish_bluesky", api_cost_usd: 0, tokens_used: 0, details: { results },
  });

  return new Response(JSON.stringify({ published: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
