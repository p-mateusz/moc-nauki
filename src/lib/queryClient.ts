import { QueryClient } from "@tanstack/react-query";

// Single shared QueryClient. Exported so non-React code (e.g. logout flow)
// can imperatively invalidate / clear the cache.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 min — szybkie ponowne odwiedziny bez refetcha
      gcTime: 1000 * 60 * 10, // 10 min — trzymaj w pamięci dłużej
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/**
 * Wipe ALL cached query data and pending mutations.
 * Wywoływać przy wylogowaniu, żeby kolejny użytkownik na tym samym
 * urządzeniu nie zobaczył danych poprzednika.
 */
export function resetQueryCache() {
  queryClient.cancelQueries();
  queryClient.clear();
  queryClient.removeQueries();
  queryClient.getMutationCache().clear();
}
