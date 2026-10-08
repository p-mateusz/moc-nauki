import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getUserIdFromRequest } from "../_shared/auth.ts";
import { reserveWebhookCall, webhookLimitResponse } from "../_shared/webhookUsage.ts";
import { createAdminClient, getRequiredWebhookUrl, webhookErrorMessage, getUsernameForUser } from "../_shared/appSettings.ts";

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
    const { word, definition, previousSentence, specialInstructions, language, definitionLanguage } = await req.json();
    const adminSb = createAdminClient();

    const limit = await reserveWebhookCall(adminSb, userId);
    if (!limit.allowed) return webhookLimitResponse(limit, corsHeaders);

    const webhookUrl = await getRequiredWebhookUrl(adminSb, "webhook_languages_sentences", "Webhook zdań");

    const def = definition?.trim() ? definition.trim() : "-";
    const formatted = `{${word} | ${def}}`;

    const definitionLanguageInfo = definitionLanguage === "pl"
      ? "polski"
      : `język docelowy (${language})`;

    const username = await getUsernameForUser(adminSb, userId);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username,
        words: formatted,
        language,
        definitionLanguage: definitionLanguageInfo,
        specialInstructions: specialInstructions || "",
        regenerate: true,
        previousSentence,
      }),
    });

    if (!response.ok) throw new Error(webhookErrorMessage("Webhook zdań", response.status, await response.text().catch(() => "")));

    const resultText = await response.text();

    let sentence = "";
    let hint = definition || "";

    try {
      const json = JSON.parse(resultText);
      if (Array.isArray(json) && json.length > 0) {
        sentence = json[0].sentence || "";
        hint = json[0].definition || json[0].hint || hint;
      } else if (json.sentence) {
        sentence = json.sentence;
        hint = json.hint || json.definition || hint;
      }
    } catch {
      const matches = resultText.match(/\{([^}]+)\}/g);
      if (matches && matches.length > 0) {
        const parts = matches[0].replace(/^\{|\}$/g, "").split("|").map(s => s.trim());
        hint = parts[1] || hint;
        sentence = parts[2] || "";
      }
    }

    return new Response(JSON.stringify({ sentence, hint }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("regenerate-sentence error:", e);
    return new Response(JSON.stringify({ error: "Operacja nie powiodła się — spróbuj ponownie" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
