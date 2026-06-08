// Shared JWT verification helper for edge functions.
// Returns the authenticated user id, or null if invalid/missing.
//
// IMPORTANT: This app uses a separate "custom" Supabase project for auth
// (yjlelwsmmrqvlsfcnxru), while edge functions run on the Lovable Cloud
// project. Tokens must be verified against the auth project, so we prefer
// CUSTOM_SUPABASE_URL / CUSTOM_SUPABASE_ANON_KEY when present.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");

  const sbUrl = Deno.env.get("CUSTOM_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("CUSTOM_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("CUSTOM_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || anonKey;
  const sb = createClient(sbUrl, anonKey);
  const adminSb = createClient(sbUrl, serviceKey);

  try {
    const { data, error } = await sb.auth.getClaims(token);
    if (!error && data?.claims?.sub) return data.claims.sub as string;
  } catch {}
  try {
    const { data, error } = await adminSb.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}
