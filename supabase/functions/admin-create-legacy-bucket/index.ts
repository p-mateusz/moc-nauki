// One-off helper to ensure the `note-images` bucket exists on the project
// where storage requests are served (the same project that hosts auth/avatars).
// Requires an authenticated admin caller.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromRequest } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sbUrl = Deno.env.get("CUSTOM_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("CUSTOM_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(sbUrl, serviceKey);

    const { data: account, error: roleErr } = await admin
      .from("user_accounts")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (roleErr || !account || account.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: list } = await admin.storage.listBuckets();
    const already = list?.some((b: any) => b.name === "note-images");
    let createError: string | null = null;
    if (!already) {
      const { error } = await admin.storage.createBucket("note-images", {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024,
      });
      if (error) {
        console.error("createBucket error:", error);
        createError = "Bucket creation failed";
      }
    }
    return new Response(
      JSON.stringify({ ok: true, alreadyExisted: !!already, createError }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("admin-create-legacy-bucket error:", e);
    return new Response(JSON.stringify({ error: "Bucket initialization failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
