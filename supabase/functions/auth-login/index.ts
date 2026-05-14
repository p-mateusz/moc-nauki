import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};



async function getSessionTokens(supabaseUrl: string, anonKey: string, email: string, password: string) {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": anonKey,
    },
    body: JSON.stringify({ email, password }),
  });
  return { ok: res.ok, status: res.status, body: await res.json() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { username, password } = await req.json();
    const normalizedUsername = username?.trim().toLowerCase();

    if (!username || !password) {
      return new Response(JSON.stringify({ error: "Podaj nazwę użytkownika i hasło" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    const adminEmail = Deno.env.get("ADMIN_EMAIL") || "wieza@lovable.cloud";
    const adminName = Deno.env.get("ADMIN_NAME") || "Mateusz";
    const ADMIN_USERNAME = adminName.trim().toLowerCase();

    // Bootstrap admin (only if matching ADMIN_NAME and ADMIN_PASSWORD provided)
    if (normalizedUsername === ADMIN_USERNAME && adminPassword && password === adminPassword) {
      await supabase
        .from("user_accounts")
        .update({ role: "student" })
        .neq("username", ADMIN_USERNAME)
        .eq("role", "admin");

      const { data: existingAdmin } = await supabase
        .from("user_accounts")
        .select("id, role, name")
        .eq("username", ADMIN_USERNAME)
        .maybeSingle();

      if (!existingAdmin) {
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: adminEmail,
          password: adminPassword,
          email_confirm: true,
          user_metadata: { name: adminName, username: ADMIN_USERNAME },
        });
        if (authError) throw authError;

        await supabase.from("user_accounts").insert({
          id: authUser.user.id,
          email: adminEmail,
          name: adminName,
          username: ADMIN_USERNAME,
          role: "admin",
          fee_exempt: true,
          subscription_status: "exempt",
        });

        await supabase.from("users").insert({ id: authUser.user.id, name: adminName });
      } else {
        const updates: any = {};
        if (existingAdmin.role !== "admin") updates.role = "admin";
        if (existingAdmin.name !== adminName) updates.name = adminName;
        if (Object.keys(updates).length > 0) {
          await supabase.from("user_accounts").update(updates).eq("id", existingAdmin.id);
        }
      }
    }

    // Find user account by username
    const { data: account } = await supabase
      .from("user_accounts")
      .select("id, name, username, email, role, webhook_suspended_at")
      .eq("username", normalizedUsername)
      .maybeSingle();

    if (!account) {
      return new Response(JSON.stringify({ error: "Nieprawidłowa nazwa użytkownika lub hasło" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (account.role === "admin" && account.username !== ADMIN_USERNAME) {
      await supabase.from("user_accounts").update({ role: "student" }).eq("id", account.id);
      account.role = "student";
    }

    if (account.webhook_suspended_at) {
      return new Response(JSON.stringify({ error: "Z racji na podejrzaną aktywność na twoim koncie zostało ono tymczasowo zawieszone — pilnie skontaktuj się z nami w celu zdjęcia blokady." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CRITICAL: Verify password by attempting actual sign-in. NEVER overwrite the password.
    const session = await getSessionTokens(supabaseUrl, anonKey, account.email, password);

    if (!session.ok || !session.body?.access_token) {
      return new Response(JSON.stringify({ error: "Nieprawidłowa nazwa użytkownika lub hasło" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      email: account.email,
      userId: account.id,
      name: account.name,
      username: account.username,
      role: account.role || "student",
      message: "Zalogowano pomyślnie",
      session: {
        access_token: session.body.access_token,
        refresh_token: session.body.refresh_token,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("auth-login error:", e);
    return new Response(JSON.stringify({ error: "Wystąpił błąd serwera" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
