/* -------------------------------- data --------------------------------
   Ponto único de acesso à camada de dados. Devolve o mock (síncrono) ou o
   Supabase (assíncrono) conforme DATA_SOURCE. Também centraliza as
   "query keys" e o mapa de invalidação usados pelo React Query no modo
   supabase (ver useResolvedDb.js).
   --------------------------------------------------------------------- */
import { makeDb } from './db.js';
import { DATA_SOURCE } from './supabase/client.js';
import { makeSupabaseDb } from './supabase/db-supabase.js';

export const IS_SUPABASE = DATA_SOURCE === 'supabase';

/**
 * Camada de dados ativa.
 * @param {{ state?: object, set?: Function }} ctx — necessário só no mock.
 */
export function getDb(ctx = {}) {
  return IS_SUPABASE ? makeSupabaseDb() : makeDb(ctx.state, ctx.set);
}

/* ----------------------------- query keys ---------------------------- */
export const qk = {
  projects: () => ['projects'],
  projectsForClient: (cid) => ['projectsForClient', cid],
  project: (pid) => ['project', pid],
  clientName: (pid) => ['clientName', pid],
  templates: () => ['templates'],
  notifications: () => ['notifications'],
  stages: (pid) => ['stages', pid],
  documents: (pid) => ['documents', pid],
  contracts: (pid) => ['contracts', pid],
  payment: (pid) => ['payment', pid],
  quotes: (pid) => ['quotes', pid],
  suppliers: (pid) => ['suppliers', pid],
  calendar: (pid) => ['calendar', pid],
};

/**
 * Quais query keys invalidar após cada mutação. `pid` é o projeto em foco
 * (contêiner) ou o passado explicitamente na mutação.
 * Retorna uma lista de arrays (query keys).
 */
export function invalidationsFor(method, pid) {
  const stages = [qk.stages(pid), qk.calendar(pid), qk.notifications()];
  const map = {
    addProject: [qk.projects(), qk.notifications()],
    addStage: stages,
    updateStage: stages,
    deleteStage: stages,
    rescheduleStage: stages,
    setStageStatus: stages,
    addSub: [qk.stages(pid)],
    toggleSub: [qk.stages(pid)],
    deleteSub: [qk.stages(pid)],
    applyTemplate: [qk.stages(pid), qk.calendar(pid)],
    addTemplate: [qk.templates()],
    deleteTemplate: [qk.templates()],
    addDocument: [qk.documents(pid)],
    deleteDocument: [qk.documents(pid)],
    setContract: [qk.contracts(pid), qk.notifications()],
    addContractDoc: [qk.contracts(pid)],
    deleteContractDoc: [qk.contracts(pid)],
    resendClientAccess: [],
    attachSubFile: [qk.stages(pid)],
    sendToAutentique: [qk.contracts(pid)],
    createPlan: [qk.payment(pid), qk.calendar(pid)],
    markPaid: [qk.payment(pid), qk.calendar(pid)],
    addQuote: [qk.quotes(pid), qk.suppliers(pid), qk.notifications()],
    updateQuote: [qk.quotes(pid), qk.suppliers(pid)],
    deleteQuote: [qk.quotes(pid), qk.suppliers(pid)],
    setQuoteStatus: [qk.quotes(pid), qk.suppliers(pid), qk.notifications()],
    setQuoteNote: [qk.quotes(pid)],
    addComment: [qk.quotes(pid)],
    addEvent: [qk.calendar(pid)],
    completeProject: [qk.project(pid), qk.projects(), qk.notifications()],
  };
  return map[method] || [];
}

// ===== atualização otimista (redesign §3.1 nº 1) =====
// A interface muda NA HORA do clique; se o servidor falhar, o catch do
// wrapper invalida a query e o estado real volta. Receitas por mutação:
const OPTIMISTIC = {
  setStageStatus: (qc, pid, [sid, status]) => {
    qc.setQueryData(qk.stages(pid), (old) =>
      old ? old.map((s) => (s.id === sid ? { ...s, status } : s)) : old,
    );
  },
  toggleSub: (qc, pid, [sid, bid]) => {
    qc.setQueryData(qk.stages(pid), (old) =>
      old
        ? old.map((s) =>
            s.id === sid
              ? { ...s, subs: (s.subs || []).map((b) => (b.id === bid ? { ...b, done: !b.done } : b)) }
              : s,
          )
        : old,
    );
  },
};

export function applyOptimistic(qc, method, pid, args) {
  const fn = OPTIMISTIC[method];
  if (fn && pid) fn(qc, pid, args);
}
