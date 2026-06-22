import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromRequest } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "chat-images";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const path = typeof body?.path === "string" ? body.path : null;
    if (!path || path.includes("..") || !/^[0-9a-f-]+\/[A-Za-z0-9._-]+$/.test(path)) {
      return new Response(JSON.stringify({ error: "Invalid path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("CUSTOM_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("CUSTOM_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller is sender or receiver of a message containing this file path.
    const { data: msg, error: msgErr } = await admin
      .from("messages")
      .select("id, sender_id, receiver_id, image_url")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .ilike("image_url", `%/${path}?%`)
      .limit(1)
      .maybeSingle();

    if (msgErr || !msg) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signed, error: signedError } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signedError || !signed?.signedUrl) throw signedError || new Error("Signed URL failed");

    return new Response(JSON.stringify({ imageUrl: signed.signedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("refresh-chat-image-url error:", e);
    return new Response(JSON.stringify({ error: "Nie udało się odświeżyć zdjęcia" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
