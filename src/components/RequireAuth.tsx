import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getSessionSafe } from "@/lib/authSession";
import { clearAuthStorage } from "@/lib/authCleanup";
import { LoadingScreen } from "@/components/ui/loading-state";

/** Zwraca bezpieczną, wewnętrzną ścieżkę powrotu (bez otwartych przekierowań). */
export function safeInternalPath(path: string | null | undefined, fallback = "/dashboard") {
  if (!path) return fallback;
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}

/**
 * Strażnik tras chronionych:
 * - weryfikuje realną sesję Supabase (nie tylko localStorage),
 * - synchronizuje `userId` z sesją, gdy się rozjedzie,
 * - reaguje na SIGNED_OUT (także z innej karty) natychmiastowym przekierowaniem,
 * - przekierowuje na /login?redirect=<ścieżka>, więc po zalogowaniu wracamy tam,
 *   gdzie użytkownik był — zamiast wpadać w niepoprawny widok.
 */
const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const guestMode =
    localStorage.getItem("guestMode") === "true" && localStorage.getItem("userId") === "guest";
  const storedUserId = localStorage.getItem("userId");
  const hasOptimisticSession = guestMode || (!!storedUserId && storedUserId !== "guest");
  const [checked, setChecked] = useState(false);
  const redirectedRef = useRef(false);

  const goToLogin = () => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    const target = `${location.pathname}${location.search}`;
    navigate(`/login?redirect=${encodeURIComponent(safeInternalPath(target))}`, { replace: true });
  };

  useEffect(() => {
    let active = true;

    if (guestMode) {
      setChecked(true);
      return;
    }

    (async () => {
      const session = await getSessionSafe(4000);
      if (!active) return;

      if (!session?.user?.id) {
        clearAuthStorage();
        goToLogin();
        return;
      }

      // Sesja jest źródłem prawdy — naprawiamy rozjechany cache localStorage.
      if (localStorage.getItem("userId") !== session.user.id) {
        try {
          localStorage.setItem("userId", session.user.id);
        } catch {}
      }
      setChecked(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !session)) {
        clearAuthStorage();
        goToLogin();
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Optymistyczny render (bez migotania), gdy mamy lokalną sesję do zweryfikowania.
  if (!checked && !hasOptimisticSession) return <LoadingScreen />;

  return <>{children}</>;
};

export default RequireAuth;
