/* ----------------------------- supabase -------------------------------
   Cliente Supabase OPCIONAL e CARREGADO SOB DEMANDA.

   A lib @supabase/supabase-js só é baixada via import() dinâmico quando
   DATA_SOURCE === 'supabase' (ver loadSupabase, chamado no boot em
   src/main.jsx). No modo mock (padrão), nada do Supabase entra no bundle
   inicial. Depois de carregado, use getSupabase() para o acesso síncrono.
   --------------------------------------------------------------------- */
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anon);

/** Fonte de dados ativa: "mock" (padrão) ou "supabase". */
export const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE || 'mock';

let _supabase = null;

/**
 * Cria (uma única vez) e devolve o cliente Supabase. Faz import() dinâmico
 * da lib — só é chamado quando o app roda em modo supabase. Devolve null se
 * as variáveis de ambiente não estiverem configuradas.
 */
export async function loadSupabase() {
  if (!isSupabaseConfigured) return null;
  if (!_supabase) {
    const { createClient } = await import('@supabase/supabase-js');
    _supabase = createClient(url, anon);
  }
  return _supabase;
}

/** Acesso síncrono ao cliente já carregado (null se ainda não carregado). */
export function getSupabase() {
  return _supabase;
}
