import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromRequest } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const normalizeRole = (role?: string) => {
  const r = (role || "").toString().toLowerCase();
  if (r === "teacher" || r === "nauczyciel") return "nauczyciel";
  if (r === "profesor") return "profesor";
  if (r === "student" || r === "uczeń" || r === "uczen") return "uczeń";
  if (r === "admin" || r === "administrator") return "admin";
  return r;
};

const isVisibleRole = (role: string, mode: string) => {
  const normalized = normalizeRole(role);
  if (mode === "teacher") return normalized === "nauczyciel" || normalized === "profesor" || normalized === "admin";
  return normalized === "uczeń" || normalized === "admin";
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { mode } = await req.json();
    if (mode !== "teacher" && mode !== "student") {
      return new Response(JSON.stringify({ error: "Invalid mode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminSb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [{ data: accounts, error: accountsError }, { data: profiles, error: profilesError }] = await Promise.all([
      adminSb.from("user_accounts").select("id, name, username, role").order("name", { ascending: true }),
      adminSb.from("user_profiles").select("user_id, avatar_color, avatar_url"),
    ]);

    if (accountsError) throw accountsError;
    if (profilesError) throw profilesError;

    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
    const users = (accounts || [])
      .filter((acc: any) => acc.id && acc.id !== userId && isVisibleRole(acc.role || "", mode))
      .map((acc: any) => {
        const profile = profileMap.get(acc.id);
        return {
          id: acc.id,
          name: acc.name || acc.username || "",
          username: acc.username || "",
          role: normalizeRole(acc.role),
          avatar_url: profile?.avatar_url || null,
          avatar_color: profile?.avatar_color || "av-c1",
        };
      });

    return new Response(JSON.stringify({ users }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("list-chat-users error:", e);
    return new Response(JSON.stringify({ error: "Operacja nie powiodła się — spróbuj ponownie" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
