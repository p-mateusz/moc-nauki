import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the authenticated user's role as stored in `user_accounts`.
 * Server-verified — never trust localStorage for authorization.
 */
export function useUserRole() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) {
        if (active) {
          setRole(null);
          setLoading(false);
        }
        return;
      }
      const { data, error } = await supabase
        .from("user_accounts")
        .select("role")
        .eq("id", uid)
        .maybeSingle();
      if (!active) return;
      if (error || !data) {
        setRole(null);
      } else {
        setRole(data.role || "uczeń");
        // Keep localStorage in sync (cache only — never used for auth)
        try { localStorage.setItem("userRole", data.role || "uczeń"); } catch {}
      }
      setLoading(false);
    };

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { role, loading, isAdmin: role === "admin", isTeacher: role === "nauczyciel" };
}
