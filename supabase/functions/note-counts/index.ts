// Returns how many notes each user has created, for the ranking view.
// Notes live in the app's main database, so we read them with the shared
// admin client and only ever return aggregate counts (never note contents).
import { getUserIdFromRequest } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/appSettings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const callerId = await getUserIdFromRequest(req);
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminSb = createAdminClient();

    const [{ data: notebooks, error: nbError }, { data: sections, error: secError }, { data: pages, error: pgError }] =
      await Promise.all([
        adminSb.from("notebooks").select("id, user_id"),
        adminSb.from("notebook_sections").select("id, notebook_id"),
        adminSb.from("notebook_pages").select("section_id"),
      ]);

    if (nbError) throw nbError;
    if (secError) throw secError;
    if (pgError) throw pgError;

    const sectionToNotebook = new Map<string, string>(
      (sections || []).map((s: any) => [String(s.id), String(s.notebook_id)]),
    );
    const notebookToUser = new Map<string, string>(
      (notebooks || []).map((n: any) => [String(n.id), String(n.user_id)]),
    );

    const counts: Record<string, number> = {};
    for (const page of pages || []) {
      const notebookId = sectionToNotebook.get(String(page.section_id));
      if (!notebookId) continue;
      const userId = notebookToUser.get(notebookId);
      if (!userId) continue;
      counts[userId] = (counts[userId] || 0) + 1;
    }

    return new Response(JSON.stringify({ counts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("note-counts error:", e);
    return new Response(JSON.stringify({ error: "Operacja nie powiodła się — spróbuj ponownie" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
