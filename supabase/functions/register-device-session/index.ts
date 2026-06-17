import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromRequest } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/appSettings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_DEVICES = 2;
// Sesje nieaktywne dłużej niż 30 dni są ignorowane przy liczeniu limitu.
const ACTIVE_WINDOW_DAYS = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const deviceId = typeof body.device_id === "string" ? body.device_id.trim() : "";
    const userAgent = typeof body.user_agent === "string" ? body.user_agent.slice(0, 500) : null;

    if (!deviceId || deviceId.length < 8 || deviceId.length > 128) {
      return new Response(JSON.stringify({ error: "Nieprawidłowy identyfikator urządzenia." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createAdminClient();
    const sinceIso = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 3600 * 1000).toISOString();

    // 1. Czy bieżące urządzenie ma już zarejestrowaną sesję?
    const { data: existing, error: existingErr } = await admin
      .from("user_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .maybeSingle();
    if (existingErr) throw existingErr;

    if (existing) {
      // Tylko odśwież last_seen_at — limit nie obowiązuje, urządzenie już istnieje.
      await admin
        .from("user_sessions")
        .update({ last_seen_at: new Date().toISOString(), user_agent: userAgent })
        .eq("id", existing.id);
      return new Response(JSON.stringify({ ok: true, refreshed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Sprawdź ile aktywnych urządzeń ma już użytkownik (innych niż obecne).
    const { data: active, error: activeErr } = await admin
      .from("user_sessions")
      .select("id, device_id")
      .eq("user_id", userId)
      .gte("last_seen_at", sinceIso);
    if (activeErr) throw activeErr;

    if ((active?.length || 0) >= MAX_DEVICES) {
      return new Response(JSON.stringify({
        error: `Przekroczono limit ${MAX_DEVICES} urządzeń zalogowanych jednocześnie. Wyloguj się z innego urządzenia, aby kontynuować.`,
        code: "device_limit_exceeded",
      }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Zarejestruj nowe urządzenie.
    const { error: insertErr } = await admin
      .from("user_sessions")
      .insert({ user_id: userId, device_id: deviceId, user_agent: userAgent });
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ ok: true, registered: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("register-device-session error:", e?.message, e?.stack);
    return new Response(JSON.stringify({ error: "Wystąpił błąd serwera." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
