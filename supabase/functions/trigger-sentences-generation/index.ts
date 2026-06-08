import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getUserIdFromRequest } from "../_shared/auth.ts";
import { reserveWebhookCall, webhookLimitResponse } from "../_shared/webhookUsage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SENTENCES_WEBHOOK_URL = Deno.env.get("N8N_SENTENCES_WEBHOOK") ?? "";

type ParsedSentence = { word: string; definition: string; sentence: string; hint: string };

function parseSentencesPayload(raw: any): ParsedSentence[] {
  const toItem = (item: any): ParsedSentence => ({
    word: (item?.word || "").toString(),
    definition: (item?.definition || item?.def || "").toString(),
    sentence: (item?.sentence || item?.example || "").toString(),
    hint: (item?.definition || item?.hint || "").toString(),
  });

  if (Array.isArray(raw)) return raw.map(toItem);
  if (raw && Array.isArray(raw.sentences)) return raw.sentences.map(toItem);
  if (raw && Array.isArray(raw.data)) return raw.data.map(toItem);

  if (typeof raw === "string") {
    const matches = raw.match(/\{([^}]+)\}/g);
    if (matches) {
      return matches.map((m) => {
        const parts = m.replace(/^\{|\}$/g, "").split("|").map((s) => s.trim());
        return {
          word: parts[0] || "",
          definition: parts[1] || "",
          sentence: parts[2] || "",
          hint: parts[1] || "",
        };
      });
    }
  }
  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authedUserId = await getUserIdFromRequest(req);
  if (!authedUserId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { listId, language, definitionLanguage, specialInstructions, proficiencyLevel } = await req.json();

    if (!listId || !language) {
      throw new Error("Missing required fields: listId, language");
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const sbUrl = Deno.env.get("CUSTOM_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("CUSTOM_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminSb = createClient(sbUrl, sbKey);

    const limit = await reserveWebhookCall(adminSb, authedUserId);
    if (!limit.allowed) return webhookLimitResponse(limit, corsHeaders);

    // Verify list ownership
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

    const { data: words, error: wordsError } = await adminSb
      .from("words")
      .select("id, word, definition")
      .eq("list_id", listId);

    if (wordsError) throw wordsError;
    if (!words || words.length === 0) {
      throw new Error("No words found for this list");
    }

    const formattedWords = words
      .map((w: any) => `{${w.word} | ${w.definition || "-"}}`)
      .join(", ");

    const definitionLanguageInfo = definitionLanguage === "pl"
      ? "polski"
      : `język docelowy (${language})`;

    // Wait synchronously for n8n response (no background callback).
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    let response: Response;
    try {
      if (!SENTENCES_WEBHOOK_URL) {
        return new Response(JSON.stringify({ error: "Service not configured" }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      response = await fetch(SENTENCES_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          words: formattedWords,
          language,
          definitionLanguage: definitionLanguageInfo,
          definitionLanguageMode: definitionLanguage,
          listId,
          userId: authedUserId,
          specialInstructions: specialInstructions || "",
          proficiencyLevel: proficiencyLevel || "B2",
        }),
      });
    } finally {
      clearTimeout(timeout);
    }

    const responseText = await response.text();
    console.log("Sentences webhook status:", response.status);

    if (!response.ok) {
      throw new Error(`Webhook ${response.status}: ${responseText.slice(0, 300)}`);
    }

    let raw: any = responseText;
    try { raw = JSON.parse(responseText); } catch { /* keep as string */ }

    const parsed = parseSentencesPayload(raw);

    // Map parsed entries to words by word string (case-insensitive)
    const generatedByWordId = new Map<string, ParsedSentence>();
    for (const s of parsed) {
      const w = words.find((x: any) => (x.word || "").toLowerCase() === s.word.toLowerCase());
      if (w) generatedByWordId.set(w.id, s);
    }

    const sentencesToInsert = words.map((w: any) => {
      const g = generatedByWordId.get(w.id);
      return {
        word_id: w.id,
        list_id: listId,
        word: w.word,
        definition: g?.definition ?? (w.definition || ""),
        sentence: g?.sentence ?? "",
        hint: g?.hint ?? (w.definition || ""),
      };
    });

    if (sentencesToInsert.length > 0) {
      // Replace any existing sentences for these words (no unique constraint on word_id, so do delete+insert)
      const wordIds = sentencesToInsert.map((s) => s.word_id);
      const { error: deleteError } = await adminSb
        .from("generated_sentences")
        .delete()
        .in("word_id", wordIds);
      if (deleteError) throw deleteError;

      const { error: insertError } = await adminSb
        .from("generated_sentences")
        .insert(sentencesToInsert);
      if (insertError) throw insertError;
    }

    await adminSb
      .from("word_lists")
      .update({ sentences_generating: false })
      .eq("id", listId);

    return new Response(
      JSON.stringify({
        success: true,
        sentenceCount: sentencesToInsert.length,
        matched: generatedByWordId.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    console.error("trigger-sentences-generation error:", e);
    // Reset generating flag so UI can recover.
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const adminSb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const body = await req.clone().json().catch(() => ({}));
      if (body?.listId) {
        await adminSb.from("word_lists").update({ sentences_generating: false }).eq("id", body.listId);
      }
    } catch (_) { /* noop */ }

    return new Response(
      JSON.stringify({ error: "Operacja nie powiodła się — spróbuj ponownie" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
