import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromRequest } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
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

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "Brak zdjęcia" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!file.type.startsWith("image/")) {
      return new Response(JSON.stringify({ error: "Plik musi być zdjęciem" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return new Response(JSON.stringify({ error: "Maksymalny rozmiar to 8 MB" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("CUSTOM_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("CUSTOM_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: buckets } = await admin.storage.listBuckets();
    if (!buckets?.some((bucket) => bucket.name === BUCKET)) {
      const { error: createError } = await admin.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: MAX_IMAGE_SIZE,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"],
      });
      if (createError && !createError.message.toLowerCase().includes("already exists")) throw createError;
    }

    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type,
    });
    if (uploadError) throw uploadError;

    const { data: signed, error: signedError } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signedError || !signed?.signedUrl) throw signedError || new Error("Signed URL failed");

    return new Response(JSON.stringify({ imageUrl: signed.signedUrl, path }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("upload-chat-image error:", e);
    return new Response(JSON.stringify({ error: "Nie udało się wysłać zdjęcia" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});