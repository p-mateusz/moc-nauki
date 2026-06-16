import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Anti-abuse limits per IP (rolling windows).
const MAX_PER_IP_PER_HOUR = 3;
const MAX_PER_IP_PER_DAY = 6;
// Backstop against egregious bursts from the same email prefix.
const MAX_PER_EMAIL_PER_DAY = 3;

// Common disposable / throwaway email domains. Not exhaustive — pragmatic block list.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com","guerrillamail.com","guerrillamail.net","guerrillamail.org","guerrillamail.biz","guerrillamail.de",
  "10minutemail.com","10minutemail.net","20minutemail.com","tempmail.com","temp-mail.org","tempmail.net","tempmailo.com",
  "yopmail.com","yopmail.fr","yopmail.net","throwawaymail.com","dispostable.com","getairmail.com","sharklasers.com",
  "trashmail.com","trashmail.de","trashmail.net","mintemail.com","maildrop.cc","mailnesia.com","mailcatch.com",
  "fakeinbox.com","mohmal.com","spambog.com","spamgourmet.com","tempr.email","emailondeck.com","mytemp.email",
  "moakt.com","mvrht.com","mailtemp.info","tmpmail.net","tmpmail.org","tmpeml.com","tmail.io","tmails.net",
  "anonbox.net","fakemailgenerator.com","dropmail.me","minuteinbox.com","spam4.me","getnada.com","nada.email","inboxbear.com",
  "harakirimail.com","mailpoof.com","emltmp.com","temp-mail.io","temp-mail.us","ezehe.com","muehlmail.com",
]);

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, name, username, password } = await req.json();

    if (!email || !name || !username || !password) {
      return new Response(JSON.stringify({ error: "Wszystkie pola są wymagane" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "Hasło musi mieć minimum 6 znaków" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedUsername = username.trim().toLowerCase();
    const ip = getClientIp(req);
    const ua = (req.headers.get("user-agent") || "").slice(0, 300);

    // --- Admin bypass: jeśli wywołujący jest zalogowanym adminem,
    // pomijamy rate-limit i blokadę domen jednorazowych (panel admina
    // legalnie tworzy konta seryjnie i z różnych e-maili).
    let isAdminCaller = false;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const { data: claims } = await supabase.auth.getClaims(token);
        const callerId = claims?.claims?.sub;
        if (callerId) {
          const { data: caller } = await supabase
            .from("user_accounts").select("role").eq("id", callerId).maybeSingle();
          if (caller?.role === "admin") isAdminCaller = true;
        }
      } catch { /* ignore — traktuj jako anon */ }
    }


    if (!isAdminCaller) {
      // --- Disposable email block ---
      const domain = trimmedEmail.split("@")[1] || "";
      if (DISPOSABLE_DOMAINS.has(domain)) {
        await supabase.from("registration_attempts").insert({
          ip, email: trimmedEmail, user_agent: ua, success: false,
        });
        return new Response(JSON.stringify({ error: "Adresy tymczasowe nie są dozwolone — użyj stałego e-maila." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // --- Per-IP / per-email rate limit ---
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      if (ip && ip !== "unknown") {
        const { count: ipHourCount } = await supabase
          .from("registration_attempts")
          .select("id", { count: "exact", head: true })
          .eq("ip", ip)
          .gte("created_at", oneHourAgo);

        if ((ipHourCount ?? 0) >= MAX_PER_IP_PER_HOUR) {
          return new Response(JSON.stringify({ error: "Zbyt wiele prób rejestracji z tego adresu. Spróbuj ponownie za godzinę." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "3600" },
          });
        }

        const { count: ipDayCount } = await supabase
          .from("registration_attempts")
          .select("id", { count: "exact", head: true })
          .eq("ip", ip)
          .gte("created_at", oneDayAgo);

        if ((ipDayCount ?? 0) >= MAX_PER_IP_PER_DAY) {
          return new Response(JSON.stringify({ error: "Dzienny limit rejestracji z tego adresu został osiągnięty." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "86400" },
          });
        }
      }

      const { count: emailDayCount } = await supabase
        .from("registration_attempts")
        .select("id", { count: "exact", head: true })
        .eq("email", trimmedEmail)
        .gte("created_at", oneDayAgo);

      if ((emailDayCount ?? 0) >= MAX_PER_EMAIL_PER_DAY) {
        return new Response(JSON.stringify({ error: "Zbyt wiele prób dla tego e-maila. Spróbuj ponownie później." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Record attempt early so abusive volume counts even when later checks fail.
      await supabase.from("registration_attempts").insert({
        ip, email: trimmedEmail, user_agent: ua, success: false,
      });
    }

    const nowIso = new Date().toISOString();


    const { data: registrationSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "registration_enabled")
      .single();

    if (registrationSetting && registrationSetting.value === "false") {
      return new Response(JSON.stringify({ error: "Rejestracja nowych kont jest obecnie wyłączona. Śledź nasze aktualności!" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check email uniqueness in user_accounts
    const { data: emailExists } = await supabase
      .from("user_accounts")
      .select("id")
      .eq("email", trimmedEmail)
      .maybeSingle();

    if (emailExists) {
      return new Response(JSON.stringify({ error: "Ten email jest już zajęty" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check username uniqueness
    const { data: usernameExists } = await supabase
      .from("user_accounts")
      .select("id")
      .eq("username", trimmedUsername)
      .maybeSingle();

    if (usernameExists) {
      return new Response(JSON.stringify({ error: "Ta nazwa użytkownika jest już zajęta" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase Auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: trimmedEmail,
      password,
      email_confirm: true,
      user_metadata: { name: name.trim(), username: trimmedUsername },
    });

    if (authError) {
      console.error("auth.admin.createUser error:", authError);
      const msg = authError.message || "";
      if (msg.includes("already been registered") || msg.includes("already registered") || msg.toLowerCase().includes("already exists")) {
        return new Response(JSON.stringify({ error: "Ten email jest już zajęty" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Nie udało się utworzyć konta — spróbuj ponownie" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authUserId = authUser.user.id;

    // Create user_accounts record — use `id` = auth user id (no user_id column)
    const { data: newAccount, error: insertError } = await supabase
      .from("user_accounts")
      .insert({
        id: authUserId,
        email: trimmedEmail,
        name: name.trim(),
        username: trimmedUsername,
        role: "uczeń",
      })
      .select("id, name, username")
      .single();

    if (insertError) {
      await supabase.auth.admin.deleteUser(authUserId);

      const duplicateUsername = insertError.code === "23505" &&
        (insertError.message?.includes("username") || insertError.message?.includes("unique"));

      if (duplicateUsername) {
        return new Response(JSON.stringify({ error: "Ta nazwa użytkownika jest już zajęta" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw insertError;
    }

    await supabase.from("users").insert({ id: authUserId, name: name.trim() });

    // Mark attempt as successful
    await supabase.from("registration_attempts")
      .update({ success: true })
      .eq("ip", ip)
      .eq("email", trimmedEmail)
      .gte("created_at", nowIso);

    // Increment registered users count in app_settings
    const { data: currentCount } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "registered_users_count")
      .single();

    const newCount = currentCount ? parseInt(currentCount.value || "0", 10) + 1 : 1;

    await supabase
      .from("app_settings")
      .upsert({ key: "registered_users_count", value: newCount.toString() }, { onConflict: "key" });

    const tokenRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": anonKey },
      body: JSON.stringify({ email: trimmedEmail, password }),
    });
    const session = await tokenRes.json();

    return new Response(JSON.stringify({
      account: newAccount,
      userId: authUserId,
      message: "Konto utworzone pomyślnie",
      session: session.access_token ? {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      } : null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("auth-register fatal:", e);
    return new Response(JSON.stringify({ error: "Wystąpił błąd serwera — spróbuj ponownie" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
