import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getUserIdFromRequest } from "../_shared/auth.ts";
import { reserveWebhookCall, webhookLimitResponse } from "../_shared/webhookUsage.ts";
import { createAdminClient, getRequiredWebhookUrl, webhookErrorMessage } from "../_shared/appSettings.ts";

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
    const { audioBase64, duration } = await req.json();
    const adminSb = createAdminClient();

    const limit = await reserveWebhookCall(adminSb, userId);
    if (!limit.allowed) return webhookLimitResponse(limit, corsHeaders);

    const webhookUrl = await getRequiredWebhookUrl(adminSb, "webhook_notes", "Webhook notatek");

    console.log("Calling transcribe-note webhook:", webhookUrl);
    console.log("Payload size:", JSON.stringify({ audioBase64, duration, type: "transcribe" }).length, "bytes");

    // Create abort controller with 25s timeout (leaving 5s buffer for edge function limit)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    let response;
    try {
      response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, duration, type: "transcribe" }),
        signal: controller.signal as any,
      });
      clearTimeout(timeoutId);
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === "AbortError") {
        throw new Error("Webhook timeout (>25s) - audio processing took too long");
      }
      throw fetchErr;
    }

    if (!response.ok) throw new Error(webhookErrorMessage("Webhook notatek", response.status, await response.text().catch(() => "")));

    const data = await response.json();

    return new Response(JSON.stringify({
      transcript: data.transcript || "",
      title: data.title || "Notatka z lekcji",
      subject: data.subject || "",
      html: data.html || data.content || "",
      calendarEvents: data.calendarEvents || [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("transcribe-note error:", e);
    return new Response(JSON.stringify({ error: "Operacja nie powiodła się — spróbuj ponownie" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
