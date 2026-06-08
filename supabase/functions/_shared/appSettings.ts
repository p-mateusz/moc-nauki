import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function createAdminClient() {
  return createClient(
    Deno.env.get("CUSTOM_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("CUSTOM_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function getAppSetting(adminSb: any, key: string): Promise<string> {
  const { data, error } = await adminSb
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) throw error;
  return typeof data?.value === "string" ? data.value.trim() : "";
}

export async function getRequiredWebhookUrl(adminSb: any, key: string, label: string): Promise<string> {
  const url = await getAppSetting(adminSb, key);
  if (!url) throw new Error(`${label} nie jest skonfigurowany w panelu administratora.`);
  return url;
}

export function webhookErrorMessage(label: string, status: number, body: string): string {
  if (status === 404 && /No workspace here|webhook-test|not found/i.test(body)) {
    return `${label} zwrócił 404 — sprawdź w panelu administratora, czy wpisany jest Production URL z aktywnego workflow n8n (/webhook/...), a nie URL testowy (/webhook-test/...).`;
  }
  return `${label} zwrócił błąd ${status}: ${body.slice(0, 300)}`;
}