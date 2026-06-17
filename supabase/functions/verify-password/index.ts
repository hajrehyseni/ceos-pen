import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "admin@dashboard.local";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password } = await req.json();
    const correctPassword = Deno.env.get("DASHBOARD_PASSWORD");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!correctPassword || !supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof password !== "string" || password !== correctPassword) {
      // Constant-ish delay to dampen brute force
      await new Promise((r) => setTimeout(r, 400));
      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Ensure the single admin user exists with the current dashboard password.
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email === ADMIN_EMAIL);

    if (!existing) {
      const { error: createErr } = await admin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: correctPassword,
        email_confirm: true,
      });
      if (createErr) {
        return new Response(
          JSON.stringify({ error: `User provisioning failed: ${createErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      // Keep the auth password in sync with DASHBOARD_PASSWORD in case it changed.
      await admin.auth.admin.updateUserById(existing.id, { password: correctPassword });
    }

    // Sign in via the anon client to get a real session for the browser.
    const anon = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: correctPassword,
    });
    if (signInErr || !signIn.session) {
      return new Response(
        JSON.stringify({ error: `Sign-in failed: ${signInErr?.message ?? "no session"}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        valid: true,
        session: {
          access_token: signIn.session.access_token,
          refresh_token: signIn.session.refresh_token,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
