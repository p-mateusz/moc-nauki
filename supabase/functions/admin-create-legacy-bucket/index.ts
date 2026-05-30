// One-off helper to ensure the `note-images` bucket exists on the legacy
// Supabase project (yjlelwsmmrqvlsfcnxru). Storage requests target that
// project, but the bucket was only created on Lovable Cloud.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sbUrl = Deno.env.get("CUSTOM_SUPABASE_URL")!;
    const serviceKey = Deno.env.get("CUSTOM_SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(sbUrl, serviceKey);

    // Try to create the bucket (private).
    const { data: created, error: createErr } = await admin.storage.createBucket("note-images", {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
    });

    // Idempotent: if it already exists, that's fine.
    const exists =
      createErr && /already exists|exists/i.test(createErr.message || "");

    // Ensure RLS policies on storage.objects for note-images.
    const sql = `
      do $$ begin
        if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='note_images_insert_own') then
          create policy "note_images_insert_own" on storage.objects for insert to authenticated
          with check (bucket_id = 'note-images' and (auth.uid())::text = (storage.foldername(name))[1]);
        end if;
        if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='note_images_select_own') then
          create policy "note_images_select_own" on storage.objects for select to authenticated
          using (bucket_id = 'note-images' and (auth.uid())::text = (storage.foldername(name))[1]);
        end if;
        if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='note_images_update_own') then
          create policy "note_images_update_own" on storage.objects for update to authenticated
          using (bucket_id = 'note-images' and (auth.uid())::text = (storage.foldername(name))[1]);
        end if;
        if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='note_images_delete_own') then
          create policy "note_images_delete_own" on storage.objects for delete to authenticated
          using (bucket_id = 'note-images' and (auth.uid())::text = (storage.foldername(name))[1]);
        end if;
      end $$;
    `;
    // Execute SQL via PostgREST RPC isn't available; rely on bucket creation + existing policies user may already have.
    // (Policies must be created manually if missing on the legacy project.)

    return new Response(
      JSON.stringify({ created: !!created, alreadyExists: !!exists, createError: createErr?.message || null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
