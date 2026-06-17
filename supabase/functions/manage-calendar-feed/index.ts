import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getUserIdFromRequest } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/appSettings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // base64url
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = (body?.action as string) || "get";
    const adminSb = createAdminClient();

    if (action !== "get" && action !== "regenerate" && action !== "revoke") {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existing } = await adminSb
      .from("user_profiles")
      .select("calendar_feed_token")
      .eq("user_id", userId)
      .maybeSingle();

    let token: string | null = existing?.calendar_feed_token ?? null;

    if (action === "revoke") {
      await adminSb
        .from("user_profiles")
        .upsert({ user_id: userId, calendar_feed_token: null }, { onConflict: "user_id" });
      return new Response(JSON.stringify({ token: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "regenerate" || !token) {
      token = generateToken();
      const { error } = await adminSb
        .from("user_profiles")
        .upsert({ user_id: userId, calendar_feed_token: token }, { onConflict: "user_id" });
      if (error) throw error;
    }

    return new Response(JSON.stringify({ token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("manage-calendar-feed error:", e);
    return new Response(JSON.stringify({ error: "Operation failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
