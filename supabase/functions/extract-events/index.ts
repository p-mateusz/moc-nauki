import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getUserIdFromRequest } from "../_shared/auth.ts";
import { reserveWebhookCall, webhookLimitResponse } from "../_shared/webhookUsage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { pageTitle, content, noteDate, subject } = await req.json();
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminSb = createClient(sbUrl, sbKey);

    const limit = await reserveWebhookCall(adminSb, userId);
    if (!limit.allowed) return webhookLimitResponse(limit, corsHeaders);

    const { data: settingRow } = await adminSb.from("app_settings").select("value").eq("key", "webhook_notes").maybeSingle();
    const webhookUrl = settingRow?.value;
    if (!webhookUrl) {
      return new Response(JSON.stringify({ events: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Calling extract-events webhook:", webhookUrl);

    // Create abort controller with 15s timeout for event extraction (doesn't need as much time as audio)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
      response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "extract-events", pageTitle, content, noteDate, subject }),
        signal: controller.signal as any,
      });
      clearTimeout(timeoutId);
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === "AbortError") {
        console.warn("extract-events webhook timeout");
        return new Response(JSON.stringify({ events: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw fetchErr;
    }

    if (!response.ok) throw new Error(`Webhook error: ${response.status}`);

    const data = await response.json();
    let events = [];
    if (Array.isArray(data)) events = data;
    else if (data.events) events = data.events;

    return new Response(JSON.stringify({ events: Array.isArray(events) ? events : [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-events error:", e);
    return new Response(JSON.stringify({ error: "Operacja nie powiodła się — spróbuj ponownie" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
