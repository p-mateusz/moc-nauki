import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


// Per-IP + per-username in-memory rate limiter (best-effort, per edge instance).
// Blokuje brute-force zgadywania haseł.
const LOGIN_HITS = new Map<string, number[]>();
const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX_PER_WINDOW = 8;

function loginRateLimited(key: string): boolean {
  const now = Date.now();
  const arr = (LOGIN_HITS.get(key) || []).filter((t) => now - t < LOGIN_WINDOW_MS);
  if (arr.length >= LOGIN_MAX_PER_WINDOW) {
    LOGIN_HITS.set(key, arr);
    return true;
  }
  arr.push(now);
  LOGIN_HITS.set(key, arr);
  return false;
}

function loginClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

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
    const adminEmail = Deno.env.get("ADMIN_EMAIL");
    const adminName = Deno.env.get("ADMIN_NAME");
    const ADMIN_USERNAME = adminName ? adminName.trim().toLowerCase() : null;

    // Bootstrap admin (only if matching ADMIN_NAME and ADMIN_PASSWORD provided)
    if (ADMIN_USERNAME && adminEmail && adminPassword && normalizedUsername === ADMIN_USERNAME && password === adminPassword) {
      const { data: existingAdmin } = await supabase
        .from("user_accounts")
        .select("id, role, name")
        .eq("username", ADMIN_USERNAME)
        .maybeSingle();

      if (!existingAdmin) {
        // Try to find existing auth user by email first
        let authUserId: string | null = null;
        const { data: created, error: authError } = await supabase.auth.admin.createUser({
          email: adminEmail,
          password: adminPassword,
          email_confirm: true,
          user_metadata: { name: adminName, username: ADMIN_USERNAME },
        });
        if (authError) {
          const code = (authError as any)?.code;
          if (code === "email_exists" || (authError.message || "").toLowerCase().includes("already been registered")) {
            // Look up existing auth user by email
            const { data: list } = await supabase.auth.admin.listUsers();
            const found = list?.users?.find((u: any) => (u.email || "").toLowerCase() === adminEmail.toLowerCase());
            if (found) authUserId = found.id;
          } else {
            throw authError;
          }
        } else {
          authUserId = created.user.id;
        }

        if (authUserId) {
          await supabase.from("user_accounts").upsert({
            id: authUserId,
            email: adminEmail,
            name: adminName,
            username: ADMIN_USERNAME,
            role: "admin",
            fee_exempt: true,
            subscription_status: "exempt",
          }, { onConflict: "id" });

          await supabase.from("users").upsert({ id: authUserId, name: adminName }, { onConflict: "id" });
        }
      } else {
        // Only ensure the role is admin. Do NOT overwrite name — admins can
        // edit their display name and it must persist across logins.
        if (existingAdmin.role !== "admin") {
          await supabase.from("user_accounts").update({ role: "admin" }).eq("id", existingAdmin.id);
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

    // Note: admin role is protected by RLS (users cannot self-promote).
    // Do not auto-downgrade admins here — ADMIN_NAME may differ from the username.

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
