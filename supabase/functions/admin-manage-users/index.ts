import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { getUserIdFromRequest } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/appSettings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createAdminClient();

    // Verify caller via JWT from the app auth backend.
    const callerId = await getUserIdFromRequest(req);
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin role
    const { data: caller } = await supabase
      .from("user_accounts")
      .select("role")
      .eq("id", callerId)
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

    // CREATE a user (admin-only, independent from public registration limits/settings)
    if (action === "create") {
      const email = String(body.email || "").trim().toLowerCase();
      const name = String(body.name || "").trim();
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "");
      const role = String(body.role || "uczeń");

      if (!email || !name || !username || !password) {
        return new Response(JSON.stringify({ error: "Wypełnij wszystkie pola" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (password.length < 6) {
        return new Response(JSON.stringify({ error: "Hasło musi mieć min. 6 znaków" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existingEmail } = await supabase
        .from("user_accounts")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (existingEmail) {
        return new Response(JSON.stringify({ error: "Ten email jest już zajęty" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existingUsername } = await supabase
        .from("user_accounts")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (existingUsername) {
        return new Response(JSON.stringify({ error: "Ta nazwa użytkownika jest już zajęta" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, username },
      });

      if (createError || !created.user?.id) {
        const message = createError?.message || "Nie udało się utworzyć konta";
        const lower = message.toLowerCase();
        const publicMessage = lower.includes("already") || lower.includes("registered")
          ? "Ten email jest już zajęty"
          : message;
        return new Response(JSON.stringify({ error: publicMessage }), {
          status: lower.includes("already") || lower.includes("registered") ? 409 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = created.user.id;
      const accountPayload: Record<string, unknown> = {
        id: userId,
        email,
        name,
        username,
        role,
      };
      if (role === "nauczyciel") {
        accountPayload.fee_exempt = true;
        accountPayload.subscription_status = "exempt";
      }

      const { data: account, error: accountError } = await supabase
        .from("user_accounts")
        .insert(accountPayload)
        .select("id, name, username")
        .single();

      if (accountError) {
        await supabase.auth.admin.deleteUser(userId);
        const duplicateUsername = accountError.code === "23505" &&
          (accountError.message?.includes("username") || accountError.message?.includes("unique"));
        return new Response(JSON.stringify({ error: duplicateUsername ? "Ta nazwa użytkownika jest już zajęta" : "Nie udało się zapisać konta" }), {
          status: duplicateUsername ? 409 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("users").insert({ id: userId, name });

      return new Response(JSON.stringify({ account, userId, success: true }), {
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
        return new Response(JSON.stringify({ error: "Błąd anulowania subskrypcji" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
