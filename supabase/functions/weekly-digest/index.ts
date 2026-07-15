// Weekly digest: top 3 published posts of the last 7 days by engagement,
// plus one exclusive insight from the latest weekly_brief. Emailed via Resend
// to every active subscriber in public.newsletter_subscribers.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromAddr = Deno.env.get("DIGEST_FROM_EMAIL") ?? "CEO Pen <onboarding@resend.dev>";

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: posts } = await supabase
    .from("posts")
    .select("id, content, pillar, published_at, post_metrics(likes,comments,reposts,impressions)")
    .eq("status", "published")
    .gte("published_at", weekAgo)
    .order("published_at", { ascending: false })
    .limit(30);

  const scored = (posts ?? []).map((p: any) => {
    const m = (p.post_metrics ?? []).reduce(
      (acc: any, r: any) => ({
        likes: acc.likes + (r.likes ?? 0),
        comments: acc.comments + (r.comments ?? 0),
        reposts: acc.reposts + (r.reposts ?? 0),
        impressions: acc.impressions + (r.impressions ?? 0),
      }),
      { likes: 0, comments: 0, reposts: 0, impressions: 0 },
    );
    return { ...p, score: m.likes + 2 * m.comments + 3 * m.reposts, m };
  }).sort((a: any, b: any) => b.score - a.score).slice(0, 3);

  const { data: brief } = await supabase
    .from("weekly_briefs")
    .select("summary_md, recommendations")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const insight = brief?.recommendations?.[0] ?? brief?.summary_md?.split("\n")[0] ?? "This week: keep shipping.";

  const subject = `CEO Pen weekly — ${scored.length} posts that landed`;
  const postsHtml = scored.map((p: any, i: number) => `
    <div style="margin:24px 0;padding:16px;background:#0f172a;border-radius:8px;color:#e2e8f0;">
      <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">${esc(p.pillar ?? "insight")} — #${i + 1}</div>
      <div style="margin-top:8px;white-space:pre-wrap;font-size:15px;line-height:1.55;">${esc(p.content.slice(0, 600))}${p.content.length > 600 ? "…" : ""}</div>
      <div style="margin-top:12px;font-size:12px;color:#64748b;">${p.m.likes} likes · ${p.m.comments} comments · ${p.m.reposts} reposts</div>
    </div>`).join("");

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#020617;font-family:-apple-system,Inter,sans-serif;color:#e2e8f0;">
    <div style="max-width:640px;margin:0 auto;">
      <h1 style="font-size:22px;margin:0 0 8px;">This week from the CEO desk</h1>
      <div style="color:#94a3b8;font-size:14px;">Week starting ${weekStart}</div>
      <div style="margin:24px 0;padding:16px;background:#1e293b;border-left:3px solid #6366f1;border-radius:4px;">
        <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Exclusive insight</div>
        <div style="margin-top:8px;font-size:15px;">${esc(insight)}</div>
      </div>
      ${postsHtml || "<p>No posts landed this week.</p>"}
      <p style="margin-top:32px;font-size:12px;color:#64748b;">You're subscribed to the CEO Pen weekly. Reply STOP to unsubscribe.</p>
    </div></body></html>`;

  const { data: subs } = await supabase
    .from("newsletter_subscribers")
    .select("email")
    .eq("active", true);
  const recipients = (subs ?? []).map((s: any) => s.email);

  let sent = 0;
  if (resendKey && recipients.length > 0) {
    // Resend allows batch via /emails/batch (up to 100/req)
    for (let i = 0; i < recipients.length; i += 100) {
      const chunk = recipients.slice(i, i + 100).map((to) => ({
        from: fromAddr, to, subject, html,
      }));
      const r = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      });
      if (r.ok) sent += chunk.length;
      else console.error("Resend batch failed:", r.status, await r.text());
    }
  }

  await supabase.from("newsletter_digests").insert({
    week_start: weekStart, subject, html, recipients: sent,
  });

  return new Response(JSON.stringify({
    posts: scored.length, recipients: recipients.length, sent,
    resend_configured: Boolean(resendKey),
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
