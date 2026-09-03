import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getUserIdSafe } from "@/lib/authSession";

export interface AccessState {
  loading: boolean;
  hasAccess: boolean;
  reason: "loading" | "admin" | "teacher" | "exempt" | "subscription" | "one_time" | "none" | "error";
  account: {
    role: string | null;
    fee_exempt: boolean;
    subscription_status: string | null;
    subscription_expires_at: string | null;
    subscription_plan: string | null;
    cancel_at_period_end: boolean;
  } | null;
}

/**
 * Centralna logika paywall.
 * - admin / nauczyciel → pełny dostęp
 * - uczeń: fee_exempt LUB aktywna subskrypcja LUB jednorazowy plan z datą w przyszłości
 */
export function useAccessGuard(): AccessState {
  const [state, setState] = useState<AccessState>({
    loading: true, hasAccess: false, reason: "loading", account: null,
  });

  useEffect(() => {
    let active = true;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    const load = async () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }
      if (active) {
        setState((prev) => ({ ...prev, loading: true, reason: prev.reason === "loading" ? "loading" : prev.reason }));
      }
      const uid = await getUserIdSafe();
      if (!uid) {
        if (active) setState({ loading: false, hasAccess: false, reason: "none", account: null });
        return;
      }
      const { data, error } = await supabase
        .from("user_accounts")
        .select("role, fee_exempt, subscription_status, subscription_expires_at, subscription_plan, cancel_at_period_end")
        .eq("id", uid)
        .maybeSingle();

      if (!active) return;
      if (error) {
        console.error("Unable to verify account access:", error);
        setState((prev) => ({
          loading: false,
          hasAccess: prev.hasAccess,
          reason: prev.hasAccess ? prev.reason : "error",
          account: prev.account,
        }));
        retryTimeout = setTimeout(() => {
          if (active) load();
        }, 3000);
        return;
      }
      if (!data) {
        setState({ loading: false, hasAccess: false, reason: "none", account: null });
        return;
      }

      const account = data as AccessState["account"];
      const role = (account?.role || "").toLowerCase();

      if (role === "admin") {
        setState({ loading: false, hasAccess: true, reason: "admin", account });
        return;
      }
      if (role === "nauczyciel" || role === "teacher") {
        setState({ loading: false, hasAccess: true, reason: "teacher", account });
        return;
      }
      if (account?.fee_exempt) {
        const exemptUntil = account?.subscription_expires_at
          ? new Date(account.subscription_expires_at).getTime()
          : null;
        if (!exemptUntil || exemptUntil > Date.now()) {
          setState({ loading: false, hasAccess: true, reason: "exempt", account });
          return;
        }
      }

      const now = Date.now();
      const expires = account?.subscription_expires_at ? new Date(account.subscription_expires_at).getTime() : null;
      const status = account?.subscription_status;
      const plan = account?.subscription_plan;

      // Aktywna subskrypcja 30-dniowa (status active i nie wygasła; cancel_at_period_end ok do daty)
      if (status === "active" && plan === "30d") {
        if (!expires || expires > now) {
          setState({ loading: false, hasAccess: true, reason: "subscription", account });
          return;
        }
      }
      // Anulowana subskrypcja - dostęp do końca okresu
      if (status === "canceled" && expires && expires > now) {
        setState({ loading: false, hasAccess: true, reason: "subscription", account });
        return;
      }
      // Plan jednorazowy 90 dni
      if (plan === "90d" && expires && expires > now) {
        setState({ loading: false, hasAccess: true, reason: "one_time", account });
        return;
      }

      setState({ loading: false, hasAccess: false, reason: "none", account });
    };

    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => window.setTimeout(load, 0));
    return () => {
      active = false;
      if (retryTimeout) clearTimeout(retryTimeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
