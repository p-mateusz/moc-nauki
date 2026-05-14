import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-webhook-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Validate shared secret — this endpoint is called by n8n only.
  const expectedSecret = Deno.env.get("SENTENCES_CALLBACK_SECRET");
  const providedSecret = req.headers.get("x-webhook-secret");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { listId, userId, sentences: rawSentences } = await req.json();
    if (!listId || !userId || !rawSentences) {
      throw new Error("Missing required fields: listId, userId, sentences");
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminSb = createClient(sbUrl, sbKey);

    // Verify list belongs to claimed user
    const { data: listRow } = await adminSb
      .from("word_lists")
      .select("id, user_id")
      .eq("id", listId)
      .maybeSingle();
    if (!listRow || listRow.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentencesList: { word: string; definition: string; sentence: string; hint: string }[] = [];

    try {
      if (Array.isArray(rawSentences)) {
        sentencesList = rawSentences.map((item: any) => ({
          word: item.word || "",
          definition: item.definition || item.def || "",
          sentence: item.sentence || item.example || "",
          hint: item.definition || item.hint || "",
        }));
      } else if (typeof rawSentences === "string") {
        const matches = rawSentences.match(/\{([^}]+)\}/g);
        if (matches) {
          sentencesList = matches.map(m => {
            const parts = m.replace(/^\{|\}$/g, "").split("|").map(s => s.trim());
            return {
              word: parts[0] || "",
              definition: parts[1] || "",
              sentence: parts[2] || "",
              hint: parts[1] || "",
            };
          });
        }
      }
    } catch (e) {
      console.error("Error parsing sentences:", e);
      throw new Error("Failed to parse sentences response");
    }

    const { data: allWords, error: wordsError } = await adminSb
      .from("words")
      .select("id, word")
      .eq("list_id", listId);

    if (wordsError) throw wordsError;
    if (!allWords || allWords.length === 0) {
      throw new Error("No words found for this list");
    }

    // Map parsed sentences to words
    const generatedMap = new Map<string, any>();
    sentencesList.forEach(s => {
      const wordData = allWords.find(w => w.word.toLowerCase() === s.word.toLowerCase());
      if (wordData) {
        generatedMap.set(wordData.id, {
          word_id: wordData.id,
          list_id: listId,
          word: s.word,
          definition: s.definition,
          sentence: s.sentence || "",
          hint: s.hint,
        });
      }
    });

    // Create entries for ALL words - use generated sentences or create empty placeholders
    const sentencesToInsert = allWords.map(word => {
      const generated = generatedMap.get(word.id);
      if (generated) {
        return generated;
      } else {
        // Create empty placeholder for words without generated sentences
        return {
          word_id: word.id,
          list_id: listId,
          word: word.word,
          definition: "",
          sentence: "",
          hint: "",
        };
      }
    });

    if (sentencesToInsert.length > 0) {
      const { error: insertError } = await adminSb
        .from("generated_sentences")
        .upsert(sentencesToInsert, {
          onConflict: "word_id",
          ignoreDuplicates: false,
        });

      if (insertError) throw insertError;
    }

    const { error: updateError } = await adminSb
      .from("word_lists")
      .update({ sentences_generating: false })
      .eq("id", listId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${sentencesToInsert.length} sentences`,
        sentenceCount: sentencesToInsert.length
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (e) {
    console.error("sentences-callback-webhook error:", e);
    return new Response(
      JSON.stringify({
        error: "Operacja nie powiodła się — spróbuj ponownie"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
