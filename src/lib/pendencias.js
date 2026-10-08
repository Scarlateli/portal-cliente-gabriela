/* Pendências (Etapa 7): o que está esperando uma ação de quem está logado.
   Diferente das notificações (o que aconteceu), uma pendência só some quando
   é resolvida. Função pura: recebe os dados já carregados (mock ou Supabase,
   no mesmo formato) e devolve a lista.

   Cada item: { id, pid, projeto, aba, texto }
   - aba: a aba do projeto onde a pendência se resolve. */

const hojeISO = () => new Date().toISOString().slice(0, 10);

export function calcularPendencias({ role, projects = [], stages = [], documents = [], contracts = [], quotes = [] }, hoje = hojeISO()) {
  const ativos = new Map(projects.filter((p) => p.status !== 'concluido').map((p) => [p.id, p]));
  const nome = (pid) => (ativos.get(pid) || {}).name || '';
  const out = [];
  const add = (id, pid, aba, texto) => {
    if (ativos.has(pid)) out.push({ id, pid, projeto: nome(pid), aba, texto });
  };
  const metodo = (c) => c.method || (c.kind === 'termo' ? 'aceite' : 'autentique');

  if (role === 'studio') {
    contracts
      .filter((c) => c.sigStatus === 'recusado')
      .forEach((c) =>
        add('c-' + c.id, c.projectId, 'contract', (c.kind === 'termo' ? 'Termo' : 'Contrato') + ' recusado pelo cliente: ' + c.name),
      );
    quotes
      .filter((q) => q.status === 'negociacao')
      .forEach((q) => add('q-' + q.id, q.projectId, 'quotes', 'Pedido de negociação: ' + q.supplier));
    stages
      .filter((s) => s.owner === 'client' && s.status !== 'concluida' && s.end && s.end < hoje)
      .forEach((s) => add('s-' + s.id, s.projectId, 'timeline', 'Etapa do cliente atrasada: ' + s.title));
    return out;
  }

  // cliente
  documents
    .filter((d) => d.approval && d.approval !== 'nenhuma' && !d.response)
    .forEach((d) =>
      add('d-' + d.id, d.projectId, 'docs', (d.approval === 'assinatura' ? 'Assinar o documento ' : 'Dar OK no documento ') + d.name),
    );
  contracts
    .filter((c) => c.sigStatus === 'enviado')
    .forEach((c) => {
      const m = metodo(c);
      const texto =
        m === 'aceite'
          ? 'Aprovar ou recusar o termo ' + c.name
          : m === 'portal'
            ? 'Assinar o contrato ' + c.name
            : 'Assinar o contrato ' + c.name + ' (link no seu e-mail, pela Autentique)';
      add('c-' + c.id, c.projectId, 'contract', texto);
    });
  quotes
    .filter((q) => q.status === 'pendente')
    .forEach((q) => add('q-' + q.id, q.projectId, 'quotes', 'Decidir sobre o orçamento de ' + q.supplier + ' (' + q.segment + ')'));
  stages
    .filter((s) => s.status !== 'concluida')
    .forEach((s) => {
      (s.subs || [])
        .filter((b) => b.responsible === 'cliente' && !b.done)
        .forEach((b, i) => add('b-' + s.id + '-' + i, s.projectId, 'timeline', b.title + ' (' + s.title + ')'));
      if (s.owner === 'client' && s.end)
        add('s-' + s.id, s.projectId, 'timeline', s.title + (s.end < hoje ? ' — prazo vencido' : ''));
    });
  return out;
}
