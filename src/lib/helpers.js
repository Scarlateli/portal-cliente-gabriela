/* ------------------------------ helpers -------------------------------
   Funções puras reutilizadas em todo o app. Mantidas sem dependências de
   React para facilitar testes unitários (ver src/lib/__tests__).
   --------------------------------------------------------------------- */

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const fmt = (iso) => (!iso || iso === '-' ? '—' : iso.split('-').reverse().join('/'));

export const money = (v) =>
  'R$ ' +
  Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const addMonthsISO = (iso, n) => {
  const d = new Date(iso + 'T00:00:00');
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};

export const uid = (p) => p + Math.random().toString(36).slice(2, 8);

/* uma etapa de responsabilidade do cliente está atrasada se passou do fim e não foi concluída */
export const stageOverdue = (s) =>
  s.owner === 'client' && s.status !== 'concluida' && !!s.end && s.end < todayISO();

export const subStats = (s) => {
  const list = s.subs || [];
  return { total: list.length, done: list.filter((b) => b.done).length };
};
