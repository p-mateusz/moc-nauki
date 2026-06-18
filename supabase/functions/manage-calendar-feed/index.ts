import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getUserIdFromRequest } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function createCloudAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) throw new Error("Missing Cloud backend credentials");
  return createClient(url, serviceKey);
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
    const adminSb = createCloudAdminClient();

    if (action !== "get" && action !== "regenerate" && action !== "revoke") {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existing } = await adminSb
      .from("user_calendar_feeds")
      .select("token")
      .eq("user_id", userId)
      .maybeSingle();

    let token: string | null = existing?.token ?? null;

    if (action === "revoke") {
      await adminSb
        .from("user_calendar_feeds")
        .upsert({ user_id: userId, token: null, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      return new Response(JSON.stringify({ token: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "regenerate" || !token) {
      token = generateToken();
      const { error } = await adminSb
        .from("user_calendar_feeds")
        .upsert({ user_id: userId, token, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
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
