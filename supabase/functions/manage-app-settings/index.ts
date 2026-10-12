import { createAdminClient } from "../_shared/appSettings.ts";
import { getUserIdFromRequest } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createAdminClient();

    // Verify caller via JWT
    const authUserId = await getUserIdFromRequest(req);
    if (!authUserId) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin role
    const { data: user } = await supabase.from("user_accounts").select("role").eq("id", authUserId).single();
    if (!user || user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const { action, key, value, keys } = await req.json();

    if (action === "get") {
      const { data, error } = await supabase.from("app_settings").select("key, value").in("key", keys || []);
      if (error) throw error;
      return new Response(JSON.stringify(data || []), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "set") {
      const { error } = await supabase.from("app_settings").upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Toggle "everyone is fee exempt" mode. Disabling also revokes the exemption
    // from every student account that currently has it.
    if (action === "set_all_fee_exempt") {
      const enabled = value === true || value === "true";
      const { error: settingError } = await supabase.from("app_settings").upsert(
        { key: "all_fee_exempt", value: enabled ? "true" : "false", updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      if (settingError) throw settingError;

      if (!enabled) {
        const { error: revokeError } = await supabase
          .from("user_accounts")
          .update({ fee_exempt: false, subscription_status: "inactive" })
          .eq("fee_exempt", true)
          .not("role", "in", '("admin","nauczyciel","profesor")');
        if (revokeError) throw revokeError;
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const { error } = await supabase.from("app_settings").delete().eq("key", key);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (e) {
    console.error("manage-app-settings error:", e);
    return new Response(JSON.stringify({ error: "Operation failed. Check server logs." }), { status: 500, headers: corsHeaders });
  }
});
