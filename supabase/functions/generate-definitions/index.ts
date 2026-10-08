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
    const { words, language, definitionLanguage, specialInstructions } = await req.json();
    const adminSb = createAdminClient();

    const limit = await reserveWebhookCall(adminSb, userId);
    if (!limit.allowed) return webhookLimitResponse(limit, corsHeaders);

    if (!Array.isArray(words) || words.length > 300) {
      return new Response(JSON.stringify({ error: "Lista może mieć maksymalnie 300 słów" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookUrl = await getRequiredWebhookUrl(adminSb, "webhook_languages", "Webhook definicji");

    // Format: {word1 | def1}, {word2 | -}, ...
    const formattedWords = (words || [])
      .map((item: any) => {
        const word = typeof item === "string" ? item.trim() : (item?.word || "").toString().trim();
        const definition = typeof item === "object" ? (item?.definition || "").toString().trim() : "";
        if (!word) return null;
        return `{${word} | ${definition || "-"}}`;
      })
      .filter(Boolean)
      .join(", ");

    const definitionLanguageInfo = definitionLanguage === "pl"
      ? "polski"
      : `język docelowy (${language})`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    let response: Response;
    try {
      console.log("Calling definitions webhook", { userId, wordsCount: words.length, language, definitionLanguage });
      const username = await getUsernameForUser(adminSb, userId);
      response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ username,
          words: formattedWords,
          formattedWords,
          language,
          definitionLanguage: definitionLanguageInfo,
          definitionLanguageMode: definitionLanguage,
          specialInstructions: specialInstructions || "",
        }),
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("Definitions webhook rejected request", {
        status: response.status,
        statusText: response.statusText,
        responsePreview: errorText.slice(0, 300),
      });
      throw new Error(webhookErrorMessage("Webhook definicji", response.status, errorText));
    }

    const resultText = await response.text();

    let definitions: { word: string; definition: string }[] = [];

    try {
      const json = JSON.parse(resultText);
      if (Array.isArray(json)) {
        definitions = json.map((item: any) => ({
          word: item.word || "",
          definition: item.definition || item.def || "-",
        }));
      } else if (json.definitions) {
        definitions = (json.definitions as any[]).map((item) => ({
          word: item.word || "",
          definition: item.definition || item.def || "-",
        }));
      } else if (json.cards) {
        definitions = (json.cards as any[]).map((item) => ({
          word: item.word || "",
          definition: item.definition || item.def || "-",
        }));
      }
    } catch {
      const matches = resultText.match(/\{([^}]+)\}/g);
      if (matches) {
        definitions = matches.map(m => {
          const parts = m.replace(/^\{|\}$/g, "").split("|").map(s => s.trim());
          return {
            word: parts[0] || "",
            definition: parts[1] || "-",
          };
        });
      }
    }

    return new Response(JSON.stringify({ definitions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("generate-definitions error:", msg, e);
    return new Response(JSON.stringify({ error: "Operacja nie powiodła się — spróbuj ponownie" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
