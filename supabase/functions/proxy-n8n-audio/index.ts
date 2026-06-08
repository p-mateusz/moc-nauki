import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getUserIdFromRequest } from "../_shared/auth.ts";
import { reserveWebhookCall, webhookLimitResponse } from "../_shared/webhookUsage.ts";
import { createAdminClient, getRequiredWebhookUrl, webhookErrorMessage } from "../_shared/appSettings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const adminSb = createAdminClient();

    const limit = await reserveWebhookCall(adminSb, userId);
    if (!limit.allowed) return webhookLimitResponse(limit, corsHeaders);

    const webhookUrl = await getRequiredWebhookUrl(adminSb, "webhook_notes", "Webhook notatek");

    const incoming = await req.formData();
    const file = incoming.get("file");
    if (!(file instanceof File) && !(file instanceof Blob)) {
      throw new Error("No audio file provided");
    }
    const duration = (incoming.get("duration") as string) || "0:00";

    // Forward file as multipart/form-data (TRUE binary upload).
    // n8n's Webhook node will expose it under `binary.file` automatically — no base64 decoding needed.
    const filename = (file as File).name || "recording.webm";
    const mime = (file as File).type || "audio/webm";
    const blob = file instanceof File
      ? new Blob([await file.arrayBuffer()], { type: mime })
      : (file as Blob);

    const outgoing = new FormData();
    outgoing.append("file", blob, filename);
    outgoing.append("duration", duration);
    outgoing.append("type", "transcribe");

    console.log("Forwarding audio (binary) to webhook:", webhookUrl);
    console.log("File:", filename, mime, blob.size, "bytes, duration:", duration);

    // 25s timeout — leaves buffer before edge function hard limit
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        body: outgoing, // browser/Deno sets multipart boundary automatically
        signal: controller.signal as any,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        console.error("n8n error response:", errText);
        throw new Error(webhookErrorMessage("Webhook notatek", response.status, errText));
      }

      const resultText = await response.text();
      console.log("n8n response length:", resultText.length, "content:", resultText.substring(0, 200));

      if (!resultText || resultText.trim() === "") {
        throw new Error("n8n returned empty response");
      }

      return new Response(resultText, {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === "AbortError") {
        throw new Error("n8n webhook timeout (>25s) - audio processing took too long");
      }
      throw fetchErr;
    }
  } catch (e) {
    console.error("proxy-n8n-audio error:", e);
    return new Response(JSON.stringify({ error: "Operacja nie powiodła się — spróbuj ponownie" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
