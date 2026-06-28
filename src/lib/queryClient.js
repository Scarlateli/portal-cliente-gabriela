/* ----------------------------- queryClient ----------------------------
   Instância única do React Query. Só tem efeito real no modo "supabase"
   (no modo "mock" as queries ficam desabilitadas — ver useResolvedDb.js).
   --------------------------------------------------------------------- */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
