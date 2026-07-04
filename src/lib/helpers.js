/* ------------------------------ helpers -------------------------------
   Funções puras reutilizadas em todo o app. Mantidas sem dependências de
   React para facilitar testes unitários (ver src/lib/__tests__).
   --------------------------------------------------------------------- */

/* Data local em YYYY-MM-DD. (toISOString usa UTC: no Brasil, a partir das
   21h ele já devolve "amanhã" — prazos venciam cedo e o "hoje" do calendário
   pulava de dia.) */
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const fmt = (iso) => (!iso || iso === '-' ? '—' : iso.split('-').reverse().join('/'));

export const money = (v) =>
  'R$ ' +
  Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/* Soma meses prendendo o dia ao fim do mês: 31/01 + 1 mês = 28/02 (o
   comportamento nativo estourava para 03/03 e "pulava" fevereiro nas
   parcelas). Sem conversão UTC no caminho. */
export const addMonthsISO = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const last = new Date(y, m - 1 + n + 1, 0).getDate();
  const res = new Date(y, m - 1 + n, Math.min(d, last));
  return `${res.getFullYear()}-${String(res.getMonth() + 1).padStart(2, '0')}-${String(res.getDate()).padStart(2, '0')}`;
};

export const uid = (p) => p + Math.random().toString(36).slice(2, 8);

/* uma etapa está atrasada se passou da previsão de fim e não foi concluída
   (independe do responsável — o studio também enxerga os próprios atrasos) */
export const stageOverdue = (s) => s.status !== 'concluida' && !!s.end && s.end < todayISO();

export const subStats = (s) => {
  const list = s.subs || [];
  return { total: list.length, done: list.filter((b) => b.done).length };
};
