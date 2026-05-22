// Shared JWT verification helper for edge functions.
// Returns the authenticated user id, or null if invalid/missing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");

  const sbUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const sb = createClient(sbUrl, anonKey);

  try {
    const { data, error } = await sb.auth.getClaims(token);
    if (!error && data?.claims?.sub) return data.claims.sub as string;
  } catch {}
  try {
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}
