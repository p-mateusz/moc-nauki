import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new TextDecoder().decode(hexEncode(new Uint8Array(hash)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller via JWT instead of trusting x-user-id header
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Verify admin role
    const { data: caller } = await supabase
      .from("user_accounts")
      .select("role")
      .eq("id", userId)
      .single();

    if (!caller || caller.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, id, updates, immediate } = body;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2024-11-20.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // LIST all users
    if (action === "list") {
      const { data, error } = await supabase
        .from("user_accounts")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;

      const today = new Date().toISOString().slice(0, 10);
      const { data: usageRows, error: usageError } = await supabase
        .from("webhook_usage")
        .select("user_id, count")
        .eq("usage_date", today);
      if (usageError) throw usageError;

      const usageMap = new Map((usageRows || []).map((row: any) => [row.user_id, row.count || 0]));
      const withUsage = (data || []).map((user: any) => ({
        ...user,
        webhook_count_today: usageMap.get(user.id) || 0,
      }));

      return new Response(JSON.stringify(withUsage), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE a user
    if (action === "update" && id) {
      const dbUpdates = { ...updates };

      // Handle password change: update Supabase Auth user only (no plaintext column)
      if (dbUpdates.new_password) {
        const plainPassword = dbUpdates.new_password;
        delete dbUpdates.new_password;
        await supabase.auth.admin.updateUserById(id, { password: plainPassword });
      }

      const { error } = await supabase
        .from("user_accounts")
        .update(dbUpdates)
        .eq("id", id);
      if (error) throw error;

      // Also update users table name if provided
      if (dbUpdates.name) {
        await supabase.from("users").update({ name: dbUpdates.name }).eq("id", id);
      }

      // Sync email to Auth user if changed
      if (dbUpdates.email) {
        await supabase.auth.admin.updateUserById(id, { email: dbUpdates.email });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CANCEL subscription (admin) — supports at_period_end (default) or immediate
    if (action === "cancel_subscription" && id) {
      try {
        const { data: target, error: targetErr } = await supabase
          .from("user_accounts")
          .select("stripe_subscription_id, stripe_customer_id, subscription_plan")
          .eq("id", id)
          .maybeSingle();

        if (targetErr) throw targetErr;
        if (!target) {
          return new Response(JSON.stringify({ error: "Użytkownik nie odnaleziony" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const subscriptionId = target.stripe_subscription_id;
        const plan = target.subscription_plan;

        if (!subscriptionId) {
          return new Response(JSON.stringify({ error: "Brak aktywnej subskrypcji w Stripe (brak subscription_id)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Prefer cancelling monthly plan (30d / 29zl) but allow other plans too
        if (immediate === true) {
          // delete subscription immediately
          await stripe.subscriptions.del(subscriptionId);
          await supabase.from("user_accounts").update({
            subscription_status: "canceled",
            subscription_expires_at: new Date().toISOString(),
            subscription_end_date: new Date().toISOString(),
            cancel_at_period_end: true,
            stripe_subscription_id: null,
          }).eq("id", id);
        } else {
          // cancel at period end
          await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
          await supabase.from("user_accounts").update({
            cancel_at_period_end: true,
          }).eq("id", id);
        }

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (err) {
        console.error("cancel_subscription error:", err);
        return new Response(JSON.stringify({ error: (err as Error).message || "Błąd anulowania subskrypcji" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // DELETE a user
    if (action === "delete" && id) {
      // Delete from Auth first
      await supabase.auth.admin.deleteUser(id);
      // Then delete from app tables
      await supabase.from("user_accounts").delete().eq("id", id);
      await supabase.from("users").delete().eq("id", id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("admin-manage-users error:", e);
    return new Response(JSON.stringify({ error: "Operation failed. Check server logs." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
