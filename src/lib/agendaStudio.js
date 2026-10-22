/* Agenda de todos os projetos, para a tela "Hoje" do studio (rodada 10):
   o que está atrasado e o que acontece nos próximos dias (reuniões, visitas,
   prazos de etapas e de sub-etapas, eventos). Função pura: recebe os dados
   já carregados (mock ou Supabase, no mesmo formato). */
import { todayISO } from './helpers.js';
import { SUB_COM_HORARIO, rotuloTipoSub, ROTULO_RESP } from './etapas.js';

const somarDias = (iso, n) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function agendaGeral({ projects = [], stages = [], events = [] }, hoje = todayISO(), dias = 7) {
  const ativos = new Map(projects.filter((p) => p.status !== 'concluido').map((p) => [p.id, p]));
  const limite = somarDias(hoje, dias);
  const atrasados = [];
  const proximos = [];
  const add = (item) => {
    const p = ativos.get(item.pid);
    if (!p || !item.data) return;
    const it = { ...item, projeto: p.name };
    if (item.data < hoje) {
      if (!item.marcado) atrasados.push(it); // reunião que passou não é "atraso"
    } else if (item.data <= limite) proximos.push(it);
  };

  stages
    .filter((s) => s.status !== 'concluida')
    .forEach((s) => {
      if (s.category === 'Reunião' || s.category === 'Visita técnica') {
        add({ id: 'e-' + s.id, pid: s.projectId, data: s.start, hora: s.time || '', titulo: s.title, tipo: s.category, marcado: true, aba: 'timeline', alvo: 'etapa-' + s.id });
      } else if (s.end) {
        add({
          id: 'p-' + s.id, pid: s.projectId, data: s.end, hora: '', titulo: s.title, tipo: 'Entrega da etapa',
          quem: s.owner === 'client' ? 'Cliente' : '', aba: 'timeline', alvo: 'etapa-' + s.id,
        });
      }
      (s.subs || [])
        .filter((b) => !b.done && b.due)
        .forEach((b) => {
          const marcado = SUB_COM_HORARIO.includes(b.kind);
          add({
            id: 'b-' + b.id, pid: s.projectId, data: b.due, hora: marcado ? b.time || '' : '', titulo: b.title,
            tipo: rotuloTipoSub(b), quem: b.responsible && b.responsible !== 'studio' ? ROTULO_RESP[b.responsible] : '',
            marcado, link: b.kind === 'reuniao' && b.format !== 'presencial' ? b.link || '' : '',
            aba: b.pedeArquivos ? 'docs' : 'timeline', alvo: (b.pedeArquivos ? 'pedido-' : 'sub-') + b.id,
          });
        });
    });
  events.forEach((e) =>
    add({ id: 'ev-' + e.id, pid: e.projectId, data: e.date, hora: e.time || '', titulo: e.title, tipo: 'Evento', marcado: true, link: e.link || '', aba: 'calendar' }),
  );

  const ordem = (a, b) => (a.data + (a.hora || '99')).localeCompare(b.data + (b.hora || '99'));
  return { atrasados: atrasados.sort(ordem), proximos: proximos.sort(ordem) };
}

// "Hoje", "Amanhã", "qua, 28/10"
export function rotuloDia(iso, hoje = todayISO()) {
  if (iso === hoje) return 'Hoje';
  if (iso === somarDias(hoje, 1)) return 'Amanhã';
  const d = new Date(iso + 'T12:00:00Z');
  const sem = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][d.getUTCDay()];
  return sem + ', ' + iso.slice(8, 10) + '/' + iso.slice(5, 7);
}
