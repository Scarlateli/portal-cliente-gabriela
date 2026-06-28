/* ----------------------------- supabase -------------------------------
   Cliente Supabase OPCIONAL. Só é criado quando as variáveis de ambiente
   estão presentes (.env). Enquanto não houver backend, o app roda 100% no
   mock em memória (ver src/lib/db.js).
   --------------------------------------------------------------------- */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anon);

/** Fonte de dados ativa: "mock" (padrão) ou "supabase". */
export const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE || 'mock';

export const supabase = isSupabaseConfigured ? createClient(url, anon) : null;
