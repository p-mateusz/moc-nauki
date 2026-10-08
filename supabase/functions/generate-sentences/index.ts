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

  const authedUserId = await getUserIdFromRequest(req);
  if (!authedUserId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { words, specialInstructions, language, definitionLanguage, listId } = await req.json();
    if (!listId) throw new Error("Missing required field: listId");
    const adminSb = createAdminClient();

    const limit = await reserveWebhookCall(adminSb, authedUserId);
    if (!limit.allowed) return webhookLimitResponse(limit, corsHeaders);

    if (!Array.isArray(words) || words.length > 300) {
      return new Response(JSON.stringify({ error: "Lista może mieć maksymalnie 300 słów" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify list ownership: only the list owner can trigger generation for an existing list
    const { data: listRow, error: listErr } = await adminSb
      .from("word_lists")
      .select("id, user_id")
      .eq("id", listId)
      .maybeSingle();

    if (listErr) throw listErr;
    if (!listRow || listRow.user_id !== authedUserId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookUrl = await getRequiredWebhookUrl(adminSb, "webhook_languages_sentences", "Webhook zdań");

    const formatted = words.map((w: any) => {
      const def = w.definition?.trim() ? w.definition.trim() : "-";
      return `{${w.word} | ${def}}`;
    }).join(", ");

    const definitionLanguageInfo = definitionLanguage === "pl"
      ? "polski"
      : `język docelowy (${language})`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const username = await getUsernameForUser(adminSb, userId);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username,
        words: formatted,
        language,
        definitionLanguage: definitionLanguageInfo,
        specialInstructions: specialInstructions || "",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!response.ok) throw new Error(webhookErrorMessage("Webhook zdań", response.status, await response.text().catch(() => "")));

    const resultText = await response.text();
    console.log("Webhook response text:", resultText);

    let sentences: { word: string; sentence: string; hint: string }[] = [];

    try {
      const json = JSON.parse(resultText);
      console.log("Parsed JSON:", json);
      
      if (Array.isArray(json)) {
        sentences = json.map((item: any) => ({
          word: item.word || "",
          sentence: item.sentence || "",
          hint: item.definition || item.hint || "",
        }));
      } else if (json.sentences) {
        sentences = json.sentences;
      } else if (json.data && Array.isArray(json.data)) {
        // Handle alternative format: { data: [...] }
        sentences = json.data.map((item: any) => ({
          word: item.word || "",
          sentence: item.sentence || "",
          hint: item.definition || item.hint || "",
        }));
      }
    } catch (parseErr) {
      console.log("JSON parse failed, trying regex:", parseErr);
      const matches = resultText.match(/\{([^}]+)\}/g);
      console.log("Regex matches:", matches);
      if (matches) {
        sentences = matches.map(m => {
          const parts = m.replace(/^\{|\}$/g, "").split("|").map(s => s.trim());
          return {
            word: parts[0] || "",
            hint: parts[1] || "",
            sentence: parts[2] || "",
          };
        });
      }
    }

    console.log("Final sentences array:", sentences);

    return new Response(JSON.stringify({ sentences }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-sentences error:", e);
    return new Response(JSON.stringify({ error: "Operacja nie powiodła się — spróbuj ponownie" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
