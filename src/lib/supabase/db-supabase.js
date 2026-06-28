/* --------------------- data layer (Supabase) — ESQUELETO ---------------
   Espelho ASSÍNCRONO da interface de src/lib/db.js (makeDb).
   IMPORTANTE: o app hoje consome os dados de forma SÍNCRONA (mock). Ligar o
   Supabase de verdade exige adaptar os componentes para async/await + estados
   de carregamento (loading). Este arquivo serve de guia/ponto de partida e
   NÃO está plugado no App ainda.

   Padrão geral:
     const { data, error } = await supabase.from('tabela').select('*')...
   A segurança (cliente só vê o próprio projeto) é garantida por RLS no banco
   — ver schema.sql.
   ----------------------------------------------------------------------- */
import { supabase } from './client.js';

export function makeSupabaseDb() {
  if (!supabase) throw new Error('Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');

  return {
    /* ---- auth ---- */
    login: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return null;
      return data.user;
    },
    logout: () => supabase.auth.signOut(),

    /* ---- leituras (exemplos) ---- */
    projects: async () => {
      const { data, error } = await supabase.from('projects').select('*').order('code');
      if (error) throw error;
      return data;
    },
    projectsForClient: async (clientId) => {
      const { data, error } = await supabase.from('projects').select('*').eq('client_id', clientId);
      if (error) throw error;
      return data;
    },
    project: async (pid) => {
      const { data, error } = await supabase.from('projects').select('*').eq('id', pid).single();
      if (error) throw error;
      return data;
    },
    stages: async (pid) => {
      const { data, error } = await supabase
        .from('stages')
        .select('*, subs:stage_subs(*)')
        .eq('project_id', pid)
        .order('ord');
      if (error) throw error;
      return data;
    },
    documents: async (pid) => {
      const { data, error } = await supabase.from('documents').select('*').eq('project_id', pid);
      if (error) throw error;
      return data;
    },

    /* ---- mutações (exemplo) ----
       Seguem o mesmo padrão: insert/update/delete + select de retorno. */
    addProject: async (d) => {
      const { data, error } = await supabase.from('projects').insert(d).select().single();
      if (error) throw error;
      return data;
    },

    /* TODO: replicar o restante dos métodos de src/lib/db.js
       (contract, payment, quotes, suppliers, calendarEvents, addStage,
        updateStage, rescheduleStage, addSub, toggleSub, deleteSub,
        setStageStatus, applyTemplate, addDocument, deleteDocument,
        setContract, createPlan, markPaid, addQuote, updateQuote,
        deleteQuote, setQuoteStatus, setQuoteNote, addComment, addEvent,
        completeProject, notifications) seguindo o mesmo padrão. */
  };
}
