import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};



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

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedUsername = username.trim().toLowerCase();

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
      return new Response(JSON.stringify({ error: `Błąd tworzenia konta: ${msg}` }), {
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
