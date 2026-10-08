import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getUserIdFromRequest } from "../_shared/auth.ts";
import { reserveWebhookCall, webhookLimitResponse } from "../_shared/webhookUsage.ts";
import { createAdminClient, getRequiredWebhookUrl, webhookErrorMessage, getUsernameForUser } from "../_shared/appSettings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Decode a data URL or raw base64 string into a Blob without exhausting the call stack.
function base64ToBlob(input: string, fallbackMime = "image/png"): Blob {
  let mime = fallbackMime;
  let b64 = input;
  const m = input.match(/^data:([^;]+);base64,(.*)$/);
  if (m) {
    mime = m[1];
    b64 = m[2];
  }
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const webhookUrl = await getRequiredWebhookUrl(adminSb, "webhook_ocr", "Webhook OCR");

    // Accept either multipart/form-data (preferred — true binary) or JSON { imageBase64 }
    const contentType = req.headers.get("content-type") || "";
    let blob: Blob;
    let filename = "image.png";
    let language = "";
    let definitionLanguage = "";

    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      const file = fd.get("file") || fd.get("image");
      if (!(file instanceof File) && !(file instanceof Blob)) {
        throw new Error("No image file provided");
      }
      filename = (file as File).name || filename;
      const mime = (file as File).type || "image/png";
      blob = file instanceof File
        ? new Blob([await file.arrayBuffer()], { type: mime })
        : (file as Blob);
      language = String(fd.get("language") || "");
      definitionLanguage = String(fd.get("definitionLanguage") || "");
    } else {
      const body = await req.json();
      const { imageBase64 } = body;
      if (!imageBase64 || typeof imageBase64 !== "string") {
        throw new Error("imageBase64 missing");
      }
      blob = base64ToBlob(imageBase64, "image/png");
      const ext = (blob.type.split("/")[1] || "png").split("+")[0];
      filename = `image.${ext}`;
      language = String(body.language || "");
      definitionLanguage = String(body.definitionLanguage || "");
    }

    const definitionLanguageInfo = definitionLanguage === "pl"
      ? "polski"
      : language
        ? `język docelowy (${language})`
        : "";

    // Forward as multipart/form-data so n8n receives a true binary file plus language metadata
    const outgoing = new FormData();
    outgoing.append("file", blob, filename);
    outgoing.append("username", await getUsernameForUser(adminSb, userId));
    if (language) outgoing.append("language", language);
    if (definitionLanguage) outgoing.append("definitionLanguage", definitionLanguage);
    if (definitionLanguageInfo) outgoing.append("definitionLanguageInfo", definitionLanguageInfo);

    console.log("Forwarding OCR image (binary) to webhook:", webhookUrl, filename, blob.type, blob.size, "bytes", { language, definitionLanguage });

    const response = await fetch(webhookUrl, {
      method: "POST",
      body: outgoing,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OCR webhook error:", errText);
      throw new Error(webhookErrorMessage("Webhook OCR", response.status, errText));
    }

    const resultText = await response.text();

    let words: { word: string; definition: string }[] = [];

    try {
      const json = JSON.parse(resultText);
      if (Array.isArray(json)) {
        words = json.map((item: any) => ({
          word: item.word || "",
          definition: item.definition || "",
        }));
      } else if (json.words) {
        words = json.words;
      }
    } catch {
      const matches = resultText.match(/\{([^}]+)\}/g);
      if (matches) {
        words = matches.map(m => {
          const parts = m.replace(/^\{|\}$/g, "").split("|").map(s => s.trim());
          return { word: parts[0] || "", definition: parts[1] || "" };
        });
      }
    }

    return new Response(JSON.stringify({ words }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ocr-extract error:", e);
    return new Response(JSON.stringify({ error: "Operacja nie powiodła się — spróbuj ponownie" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
