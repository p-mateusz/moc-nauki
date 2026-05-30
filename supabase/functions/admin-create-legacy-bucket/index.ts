// One-off helper to ensure the `note-images` bucket exists on the project
// where storage requests are served (the same project that hosts auth/avatars).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const sbUrl = Deno.env.get("CUSTOM_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("CUSTOM_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(sbUrl, serviceKey);

    const { data: list } = await admin.storage.listBuckets();
    const already = list?.some((b: any) => b.name === "note-images");
    let createError: string | null = null;
    if (!already) {
      const { error } = await admin.storage.createBucket("note-images", {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024,
      });
      if (error) createError = error.message;
    }
    return new Response(
      JSON.stringify({ ok: true, alreadyExisted: !!already, createError, target: sbUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
