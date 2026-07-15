// Publish an approved X (Twitter) variant.
// Requires OAuth 1.0a user context — Twitter connector's api_key auth is
// read-only, so we sign directly with TWITTER_CONSUMER_KEY/SECRET +
// TWITTER_ACCESS_TOKEN/SECRET. The X account MUST have "Read and Write"
// permissions enabled in the Developer Portal (default is Read only).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_TWEET = 275;
const X_API = "https://api.x.com/2";

function pct(s: string): string {
  return encodeURIComponent(s).replace(/[!*'()]/g, (c) =>
    "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

/** OAuth 1.0a Authorization header for a JSON POST body (body is NOT signed). */
function oauth1Header(
  method: "POST",
  url: string,
  extraQuery: Record<string, string>,
  ck: string, cs: string, at: string, ats: string,
): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: ck,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ""),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: at,
    oauth_version: "1.0",
  };
  const params: Record<string, string> = { ...oauth, ...extraQuery };
  const paramStr = Object.keys(params).sort()
    .map((k) => `${pct(k)}=${pct(params[k])}`).join("&");
  const base = `${method}&${pct(url)}&${pct(paramStr)}`;
  const key = `${pct(cs)}&${pct(ats)}`;
  const sig = hmac("sha1", key, base, "utf8", "base64") as string;
  oauth.oauth_signature = sig;
  return "OAuth " + Object.keys(oauth).sort()
    .map((k) => `${pct(k)}="${pct(oauth[k])}"`).join(", ");
}

async function postTweet(
  text: string, reply_to: string | null,
  ck: string, cs: string, at: string, ats: string,
): Promise<{ id: string }> {
  const body: any = { text };
  if (reply_to) body.reply = { in_reply_to_tweet_id: reply_to };
  const url = `${X_API}/tweets`;
  const auth = oauth1Header("POST", url, {}, ck, cs, at, ats);
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`X [${r.status}]: ${await r.text()}`);
  const data = await r.json();
  return { id: data.data.id };
}

function splitThread(raw: string): string[] {
  const parts = raw.split(/\n?---\n?/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    if (p.length <= MAX_TWEET) { out.push(p); continue; }
    // Fallback: hard-wrap on word boundaries
    let rest = p;
    while (rest.length > MAX_TWEET) {
      const slice = rest.slice(0, MAX_TWEET);
      const cut = slice.lastIndexOf(" ");
      const take = cut > 200 ? cut : MAX_TWEET;
      out.push(rest.slice(0, take).trim());
      rest = rest.slice(take).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ck = Deno.env.get("TWITTER_CONSUMER_KEY");
  const cs = Deno.env.get("TWITTER_CONSUMER_SECRET");
  const at = Deno.env.get("TWITTER_ACCESS_TOKEN");
  const ats = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");
  if (!ck || !cs || !at || !ats) {
    return new Response(JSON.stringify({ error: "Missing Twitter OAuth 1.0a secrets" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* ok */ }
  const variantId: string | undefined = body.variant_id;

  let q = supabase.from("channel_variants").select("*").eq("channel", "x").eq("status", "approved");
  if (variantId) q = q.eq("id", variantId);
  const { data: variants } = await q.limit(5);
  if (!variants || variants.length === 0) {
    return new Response(JSON.stringify({ published: 0, note: "no approved X variants" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  for (const v of variants) {
    try {
      const tweets = splitThread(v.variant_text);
      let replyTo: string | null = null;
      let firstId: string | null = null;
      for (const t of tweets) {
        const { id } = await postTweet(t, replyTo, ck, cs, at, ats);
        replyTo = id;
        firstId = firstId ?? id;
      }
      const url = firstId ? `https://x.com/i/status/${firstId}` : null;
      await supabase.from("channel_variants").update({
        status: "published",
        external_url: url,
        published_at: new Date().toISOString(),
      }).eq("id", v.id);
      results.push({ variant_id: v.id, status: "published", url, tweets: tweets.length });
    } catch (e) {
      console.error("publish-x failed:", e);
      results.push({ variant_id: v.id, status: "failed", error: String(e) });
    }
  }

  await supabase.from("agent_log").insert({
    action: "publish_x",
    api_cost_usd: 0, tokens_used: 0,
    details: { results },
  });

  return new Response(JSON.stringify({ published: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
