export const WEBHOOK_DAILY_LIMIT = 30;

const SUSPENSION_MESSAGE = "Z racji na podejrzaną aktywność na twoim koncie zostało ono tymczasowo zawieszone — pilnie skontaktuj się z nami w celu zdjęcia blokady.";

type LimitAllowed = { allowed: true; count: number };
type LimitBlocked = { allowed: false; status: number; error: string; suspended: boolean };
export type WebhookLimitResult = LimitAllowed | LimitBlocked;

export function webhookLimitResponse(result: LimitBlocked, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ error: result.error, suspended: result.suspended }), {
    status: result.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function reserveWebhookCall(adminSb: any, userId: string): Promise<WebhookLimitResult> {
  const { data: account, error: accountError } = await adminSb
    .from("user_accounts")
    .select("webhook_suspended_at, role")
    .eq("id", userId)
    .maybeSingle();

  if (accountError) throw accountError;

  if (account?.role === "admin") {
    return { allowed: true, count: 0 };
  }

  if (account?.webhook_suspended_at) {
    return { allowed: false, status: 403, error: SUSPENSION_MESSAGE, suspended: true };
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: usage, error: usageError } = await adminSb
    .from("webhook_usage")
    .select("count")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .maybeSingle();

  if (usageError) throw usageError;

  const currentCount = Number(usage?.count || 0);
  if (currentCount >= WEBHOOK_DAILY_LIMIT) {
    await adminSb
      .from("user_accounts")
      .update({
        webhook_suspended_at: new Date().toISOString(),
        webhook_suspended_reason: `Przekroczono dzienny limit ${WEBHOOK_DAILY_LIMIT} wywołań webhooków`,
      })
      .eq("id", userId);

    return { allowed: false, status: 429, error: SUSPENSION_MESSAGE, suspended: true };
  }

  const nextCount = currentCount + 1;
  const { error: upsertError } = await adminSb
    .from("webhook_usage")
    .upsert(
      { user_id: userId, usage_date: today, count: nextCount, updated_at: new Date().toISOString() },
      { onConflict: "user_id,usage_date" },
    );

  if (upsertError) throw upsertError;

  return { allowed: true, count: nextCount };
}
