/* Pendências: o que está esperando uma ação de quem está logado.
   Diferente das notificações (o que aconteceu), uma pendência só some quando
   é resolvida. Função pura: recebe os dados já carregados (mock ou Supabase,
   no mesmo formato) e devolve a lista.

   Cada item: { id, pid, projeto, aba, alvo, texto }
   - aba: a aba do projeto onde a pendência se resolve;
   - alvo: o item dentro da aba (o portal rola até ele e o destaca).

   Rodada 4: tarefas e prazos do cliente só entram quando estão perto
   (até PRAZO_PROXIMO_DIAS) ou vencidos. Pedidos explícitos (aprovar etapa,
   confirmar documento, assinar, decidir orçamento) entram sempre. */

import { todayISO } from './helpers.js';

export const PRAZO_PROXIMO_DIAS = 7;

// data local (no Brasil, depois das 21h o UTC já é o dia seguinte)
const hojeISO = todayISO;
const somarDias = (iso, n) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dataBR = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7);

export function calcularPendencias(
  { role, projects = [], stages = [], documents = [], contracts = [], quotes = [], arquivos = [] },
  hoje = hojeISO(),
) {
  const ativos = new Map(projects.filter((p) => p.status !== 'concluido').map((p) => [p.id, p]));
  const nome = (pid) => (ativos.get(pid) || {}).name || '';
  const out = [];
  const add = (id, pid, aba, alvo, texto) => {
    if (ativos.has(pid)) out.push({ id, pid, projeto: nome(pid), aba, alvo, texto });
  };
  const metodo = (c) => c.method || (c.kind === 'termo' ? 'aceite' : 'autentique');
  const limite = somarDias(hoje, PRAZO_PROXIMO_DIAS);
  const perto = (iso) => !!iso && iso <= limite; // inclui os vencidos
  const quando = (iso) => (iso < hoje ? ' · atrasada' : iso === hoje ? ' · vence hoje' : ' · até ' + dataBR(iso));
  const comArquivo = new Set(arquivos.map((a) => a.subId));

  if (role === 'studio') {
    stages
      .filter((s) => s.approval === 'ajustes')
      .forEach((s) => add('e-' + s.id, s.projectId, 'timeline', 'etapa-' + s.id, 'Ajustes pedidos na etapa: ' + s.title));
    documents
      .filter((d) => d.response === 'ajustes')
      .forEach((d) => add('d-' + d.id, d.projectId, 'docs', 'doc-' + d.id, 'Ajustes pedidos no documento: ' + d.name));
    contracts
      .filter((c) => c.sigStatus === 'recusado')
      .forEach((c) => add('c-' + c.id, c.projectId, 'contract', 'contrato-' + c.id, 'Recusado pelo cliente: ' + c.name));
    quotes
      .filter((q) => q.status === 'negociacao')
      .forEach((q) => add('q-' + q.id, q.projectId, 'quotes', 'orc-' + q.id, 'Pedido de negociação: ' + q.supplier));
    stages.forEach((s) =>
      (s.subs || [])
        // rodada 6: só quando o cliente conclui a entrega (antes, qualquer
        // arquivo já avisava, mesmo com o cliente ainda mandando)
        .filter((b) => b.pedeArquivos && !b.done && b.entregueEm)
        .forEach((b) => add('a-' + b.id, s.projectId, 'docs', 'pedido-' + b.id, 'Entrega do cliente para conferir: ' + b.title)),
    );
    stages
      .filter((s) => s.owner === 'client' && s.status !== 'concluida' && s.end && s.end < hoje)
      .forEach((s) => add('s-' + s.id, s.projectId, 'timeline', 'etapa-' + s.id, 'Etapa do cliente atrasada: ' + s.title));
    return out;
  }

  // cliente — primeiro o que ele precisa decidir, depois o que tem prazo
  stages
    .filter((s) => s.approval === 'pendente')
    .forEach((s) => add('e-' + s.id, s.projectId, 'timeline', 'etapa-' + s.id, 'Aprovar a etapa: ' + s.title));
  documents
    .filter((d) => d.approval && d.approval !== 'nenhuma' && !d.response)
    .forEach((d) =>
      add('d-' + d.id, d.projectId, 'docs', 'doc-' + d.id, (d.approval === 'assinatura' ? 'Assinar: ' : 'Aprovar: ') + d.name),
    );
  contracts
    .filter((c) => c.sigStatus === 'enviado')
    .forEach((c) => {
      const m = metodo(c);
      const texto =
        m === 'aceite'
          ? 'Aprovar ou recusar: ' + c.name
          : m === 'portal'
            ? 'Assinar: ' + c.name
            : 'Assinar pelo e-mail da Autentique: ' + c.name;
      add('c-' + c.id, c.projectId, 'contract', 'contrato-' + c.id, texto);
    });
  quotes
    .filter((q) => q.status === 'pendente')
    .forEach((q) =>
      add('q-' + q.id, q.projectId, 'quotes', 'orc-' + q.id, 'Decidir orçamento: ' + q.supplier + ' (' + q.segment + ')'),
    );
  stages
    .filter((s) => s.status !== 'concluida')
    .forEach((s) => {
      (s.subs || [])
        .filter((b) => b.responsible === 'cliente' && !b.done && perto(b.due))
        .forEach((b) => {
          if (b.pedeArquivos) {
            if (!b.entregueEm)
              add(
                'b-' + b.id,
                s.projectId,
                'docs',
                'pedido-' + b.id,
                (comArquivo.has(b.id) ? 'Concluir entrega: ' : 'Enviar arquivos: ') + b.title + quando(b.due),
              );
          } else add('b-' + b.id, s.projectId, 'timeline', 'sub-' + b.id, 'Tarefa: ' + b.title + quando(b.due));
        });
      if (s.owner === 'client' && perto(s.end))
        add('s-' + s.id, s.projectId, 'timeline', 'etapa-' + s.id, (s.end < hoje ? 'Prazo vencido: ' : 'Etapa sua: ') + s.title);
    });
  return out;
}

/* Próximo prazo do projeto, contando etapas e sub-etapas que ainda não
   terminaram: { data, titulo, atrasado } ou null. */
export function proximoPrazo(stages = [], hoje = hojeISO()) {
  const prazos = [];
  stages
    .filter((s) => s.status !== 'concluida')
    .forEach((s) => {
      if (s.end) prazos.push({ data: s.end, titulo: s.title });
      (s.subs || []).filter((b) => !b.done && b.due).forEach((b) => prazos.push({ data: b.due, titulo: b.title }));
    });
  if (!prazos.length) return null;
  const futuros = prazos.filter((p) => p.data >= hoje).sort((a, b) => (a.data < b.data ? -1 : 1));
  if (futuros.length) return { ...futuros[0], atrasado: false };
  // tudo vencido: mostra o mais antigo, marcado como atrasado
  const vencido = prazos.sort((a, b) => (a.data < b.data ? -1 : 1))[0];
  return { ...vencido, atrasado: true };
}

/* Topo do projeto (rodada 5): a etapa macro com o próximo prazo, para
   mostrar o nome da fase e "Prazo – data". Só etapas, sem sub-etapas.
   { titulo, data, atrasado } ou null. Sem prazo marcado, devolve a etapa
   em andamento com data null. */
export function proximaEtapa(stages = [], hoje = hojeISO()) {
  const abertas = stages.filter((s) => s.status !== 'concluida');
  const comPrazo = abertas.filter((s) => s.end).sort((a, b) => (a.end < b.end ? -1 : 1));
  const futura = comPrazo.find((s) => s.end >= hoje);
  if (futura) return { titulo: futura.title, data: futura.end, atrasado: false };
  if (comPrazo.length) return { titulo: comPrazo[0].title, data: comPrazo[0].end, atrasado: true };
  const atual = abertas.find((s) => s.status === 'em_andamento');
  return atual ? { titulo: atual.title, data: null, atrasado: false } : null;
}
