/* ----------------------------- queryClient ----------------------------
   Instância única do React Query. Só tem efeito real no modo "supabase"
   (no modo "mock" as queries ficam desabilitadas — ver useResolvedDb.js).

   Rodada 11: o studio e o cliente usam o portal ao mesmo tempo, cada um na
   sua tela. Antes, uma tela aberta nunca buscava de novo (o que o cliente
   aprovava não aparecia para a Gabriela, e vice-versa, até recarregar a
   página). Agora busca de novo:
   - ao voltar para a aba ou para o app (refetchOnWindowFocus);
   - a cada 45 s enquanto a aba está visível (refetchInterval; parado em
     segundo plano);
   - ao reconectar à internet.
   O que a pessoa está digitando não se perde: formulários guardam o próprio
   estado. */
import { QueryClient } from '@tanstack/react-query';

export const ATUALIZAR_A_CADA = 45_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: ATUALIZAR_A_CADA,
      refetchIntervalInBackground: false,
      staleTime: 15_000,
    },
  },
});
