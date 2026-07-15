/* ---------------------------- useResolvedDb ---------------------------
   Resolve a camada de dados para um CONTÊINER (AdminHome, ProjectView,
   PrintView, ClientPicker).

   - Modo mock: devolve o próprio db síncrono (caminho de hoje, intacto).
   - Modo supabase: dispara o prefetch (React Query) das keys que o
     contêiner precisa, expõe loading/erro e monta um `db` SÍNCRONO que lê
     do cache — assim as abas continuam fazendo db.stages(pid) e recebendo
     o array na hora, sem mudar. As mutações chamam o método async e
     invalidam as keys afetadas (ver invalidationsFor em data.js).

   Regras dos Hooks: os hooks do React Query são sempre chamados; no modo
   mock ficam `enabled: false` e são ignorados.
   --------------------------------------------------------------------- */
import { useMemo, useState, useCallback } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { IS_SUPABASE, qk, invalidationsFor, applyOptimistic } from './data.js';

const READ_METHODS = [
  'projects',
  'projectsForClient',
  'project',
  'clientName',
  'templates',
  'notifications',
  'stages',
  'documents',
  'contracts',
  'payment',
  'quotes',
  'suppliers',
  'calendarEvents',
];

const ALL_MUTATIONS = [
  'addProject',
  'addStage',
  'updateStage',
  'deleteStage',
  'rescheduleStage',
  'setStageStatus',
  'addSub',
  'toggleSub',
  'deleteSub',
  'applyTemplate',
  'addTemplate',
  'deleteTemplate',
  'addDocument',
  'deleteDocument',
  'setContract',
  'addContractDoc',
  'deleteContractDoc',
  'resendClientAccess',
  'attachSubFile',
  'createPlan',
  'markPaid',
  'addQuote',
  'updateQuote',
  'deleteQuote',
  'setQuoteStatus',
  'setQuoteNote',
  'addComment',
  'addEvent',
  'completeProject',
];

// métodos cujo 1º argumento é o pid (usado p/ escolher o que invalidar)
const PID_FIRST = new Set([
  'addStage',
  'applyTemplate',
  'addDocument',
  'addContractDoc',
  'deleteContractDoc',
  'resendClientAccess',
  'attachSubFile',
  'createPlan',
  'markPaid',
  'addQuote',
  'addEvent',
  'completeProject',
]);

/**
 * @param {object} baseDb  — db do getDb() (mock ou supabase)
 * @param {Array}  specs   — [{ key: queryKey, fn: () => baseDb.x(...) }]
 * @param {string} scopePid — projeto do contêiner (p/ invalidação), se houver
 */
export function useResolvedDb(baseDb, specs, scopePid = null) {
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);

  const queries = useQueries({
    queries: specs.map((s) => ({
      queryKey: s.key,
      queryFn: s.fn,
      enabled: IS_SUPABASE,
    })),
  });

  const loading = IS_SUPABASE && queries.some((q) => q.isLoading);
  const queryError = IS_SUPABASE ? queries.find((q) => q.isError) : null;

  const invalidate = useCallback(
    (method, pid) => {
      for (const key of invalidationsFor(method, pid ?? scopePid)) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
    [queryClient, scopePid],
  );

  // db síncrono que lê do cache + mutações que invalidam (modo supabase)
  const supaSyncDb = useMemo(() => {
    if (!IS_SUPABASE) return null;
    const out = {};
    for (const m of READ_METHODS) {
      out[m] = (...args) => {
        const key =
          m === 'projects'
            ? qk.projects()
            : m === 'projectsForClient'
              ? qk.projectsForClient(args[0])
              : m === 'project'
                ? qk.project(args[0])
                : m === 'clientName'
                  ? qk.clientName(args[0])
                  : m === 'templates'
                    ? qk.templates()
                    : m === 'notifications'
                      ? qk.notifications()
                      : m === 'calendarEvents'
                        ? qk.calendar(args[0])
                        : [m, args[0]];
        return queryClient.getQueryData(key);
      };
    }
    for (const m of ALL_MUTATIONS) {
      out[m] = (...args) => {
        const pid = PID_FIRST.has(m) ? args[0] : scopePid;
        // otimista: reflete o clique na hora; o servidor confirma em seguida
        applyOptimistic(queryClient, m, pid, PID_FIRST.has(m) ? args.slice(1) : args);
        return Promise.resolve(baseDb[m](...args))
          .then((r) => {
            invalidate(m, pid);
            return r;
          })
          .catch((e) => {
            invalidate(m, pid); // desfaz o otimista com o estado real
            setError(e);
            throw e;
          });
      };
    }
    out.fileUrl = (...args) => baseDb.fileUrl(...args);
    return out;
  }, [baseDb, queryClient, invalidate, scopePid]);

  if (!IS_SUPABASE) return { ready: true, db: baseDb };
  if (loading) return { ready: false, loading: true };
  if (queryError) return { ready: false, error: queryError.error };
  return { ready: true, db: supaSyncDb, error, clearError: () => setError(null) };
}

/** Helper p/ montar specs a partir do baseDb e uma lista de leituras. */
export function specsFor(baseDb, list) {
  return list.map(({ key, method, args = [] }) => ({
    key,
    fn: () => baseDb[method](...args),
  }));
}
