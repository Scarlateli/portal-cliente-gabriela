/* --------------------------- dados (seed) -----------------------------
   Mock em memória, no formato das tabelas do Supabase. Os dados NÃO
   persistem entre sessões — isso entra com o backend (ver lib/supabase).
   --------------------------------------------------------------------- */

export const seed = {
  users: [
    { id: 'u1', role: 'client', name: 'Vanessa Tamura', email: 'cliente@demo.com', pass: '1234' },
    { id: 'u2', role: 'client', name: 'Marcos Lindner', email: 'cliente2@demo.com', pass: '1234' },
    { id: 'g1', role: 'studio', name: 'Gabriela', email: 'studio@demo.com', pass: '1234' },
  ],
  projects: [
    {
      id: 'p1', code: 'FRV-001', name: 'Residência Franvan', clientId: 'u1', status: 'em_andamento',
      address: 'Rua Michigan, 1620 — Brooklin, São Paulo', start: '2026-02-23', due: '2026-07-15',
      completedAt: null, accessUntil: null,
    },
    {
      id: 'p2', code: 'LIN-002', name: 'Apartamento Lindner', clientId: 'u2', status: 'em_andamento',
      address: 'Av. Brasil, 880 — Jardins, São Paulo', start: '2026-05-05', due: '2026-11-20',
      completedAt: null, accessUntil: null,
    },
  ],
  stages: [
    {
      id: 's1', projectId: 'p1', ord: 1, title: 'Reunião de briefing', category: 'Reunião', status: 'concluida', owner: 'studio', start: '2026-03-17', end: '2026-03-17', time: '10:00', presencial: true, link: '', desc: 'Levantamento de necessidades, estilo de vida, referências e escopo do projeto.', subs: [
        { id: 'sb1', title: 'Referências do cliente', done: true },
        { id: 'sb2', title: 'Reunião de briefing', done: true },
        { id: 'sb3', title: 'Levantamento técnico', done: true },
      ],
    },
    {
      id: 's2', projectId: 'p1', ord: 2, title: 'Envio de referências e aprovações', category: 'Documentação', status: 'em_andamento', owner: 'client', start: '2026-05-25', end: '2026-06-10', time: '', link: '', presencial: false, desc: 'Materiais que o cliente precisa enviar e aprovar para liberar a próxima etapa.', subs: [
        { id: 'sb4', title: 'Enviar fotos do espaço', done: true },
        { id: 'sb5', title: 'Aprovar moodboard', done: false },
        { id: 'sb6', title: 'Enviar plantas do prédio', done: false },
      ],
    },
    { id: 's3', projectId: 'p1', ord: 3, title: 'Apresentação do projeto 3D', category: 'Reunião', status: 'em_andamento', owner: 'studio', start: '2026-06-27', end: '2026-06-27', time: '14:00', presencial: false, link: 'https://meet.google.com/abc-defg-hij', desc: 'Apresentação da modelagem 3D com materiais, cores e iluminação.', subs: [] },
    { id: 's4', projectId: 'p1', ord: 4, title: 'Projeto executivo', category: 'Entrega', status: 'a_fazer', owner: 'studio', start: '2026-07-01', end: '2026-07-10', time: '', link: '', presencial: false, desc: 'Detalhamento técnico, pranchas e especificações para a execução da obra.', subs: [] },
    { id: 's5', projectId: 'p2', ord: 1, title: 'Reunião de briefing', category: 'Reunião', status: 'concluida', owner: 'studio', start: '2026-05-12', end: '2026-05-12', time: '09:30', presencial: true, link: '', desc: 'Primeira reunião de levantamento de necessidades.', subs: [] },
    { id: 's6', projectId: 'p2', ord: 2, title: 'Medição no local', category: 'Visita técnica', status: 'em_andamento', owner: 'studio', start: '2026-06-20', end: '2026-06-22', time: '', link: '', presencial: false, desc: 'Visita técnica para medição dos ambientes.', subs: [] },
  ],
  templates: [
    {
      id: 't1', name: 'Projeto de interiores (padrão)', items: [
        { title: 'Reunião de briefing', category: 'Reunião', desc: 'Levantamento de necessidades e escopo.' },
        { title: 'Medição no local', category: 'Visita técnica', desc: 'Visita técnica para medição dos ambientes.' },
        { title: 'Layout e referências', category: 'Documentação', desc: 'Distribuição dos ambientes e painel de referências.' },
        { title: 'Projeto 3D', category: 'Produção', desc: 'Modelagem tridimensional dos ambientes.' },
        { title: 'Detalhamento executivo', category: 'Entrega', desc: 'Pranchas técnicas e especificações.' },
        { title: 'Acompanhamento de obra', category: 'Visita técnica', desc: 'Visitas de acompanhamento durante a execução.' },
      ],
    },
  ],
  documents: [
    { id: 'd1', projectId: 'p1', name: 'Ata — reunião de briefing.pdf', type: 'ata', size: '0,3 MB', date: '2026-03-17' },
    { id: 'd2', projectId: 'p1', name: 'Briefing do cliente.pdf', type: 'briefing', size: '0,9 MB', date: '2026-03-18' },
    { id: 'd3', projectId: 'p1', name: 'Planta — layout proposto.pdf', type: 'planta', size: '1,8 MB', date: '2026-04-30' },
  ],
  contracts: [
    { id: 'c1', projectId: 'p1', name: 'Contrato de prestação de serviços', sigStatus: 'enviado', provider: 'ZapSign', signer: null, signedAt: null },
    { id: 'c2', projectId: 'p2', name: 'Contrato de prestação de serviços', sigStatus: 'rascunho', provider: null, signer: null, signedAt: null },
  ],
  payments: [
    {
      id: 'pay1', projectId: 'p1', total: 24000, installments: [
        { n: 1, amount: 8000, due: '2026-03-01', status: 'pago', paidAt: '2026-03-01' },
        { n: 2, amount: 8000, due: '2026-05-01', status: 'pago', paidAt: '2026-05-03' },
        { n: 3, amount: 8000, due: '2026-06-01', status: 'pendente', paidAt: null },
      ],
    },
  ],
  quotes: [
    { id: 'q1', projectId: 'p1', segment: 'Marcenaria', supplier: 'Marcenaria Bianchi', amount: 32000, fileName: 'orcamento-bianchi.pdf', status: 'pendente', studioNote: 'Melhor custo-benefício entre os 3 que cotei. Prazo de 45 dias.', comments: [], decidedAt: null, contact: '', deadline: '', payment: '', contractStatus: 'a_iniciar', notes: '' },
    { id: 'q2', projectId: 'p1', segment: 'Iluminação', supplier: 'Lumini Iluminação', amount: 9800, fileName: 'orcamento-lumini.pdf', status: 'aprovado', studioNote: 'Inclui projeto luminotécnico e instalação.', comments: [{ author: 'client', body: 'Pode aprovar, gostei das luminárias.', at: 'Ontem 14:10' }], decidedAt: '2026-06-10', contact: 'Patrícia · (11) 95555-0102 · contato@lumini.com.br', deadline: '30 dias após aprovação', payment: '50% entrada, 50% na entrega', contractStatus: 'em_producao', notes: 'Garantia de 1 ano nas luminárias. Instalação inclusa.' },
    { id: 'q3', projectId: 'p1', segment: 'Marmoraria', supplier: 'Mármores SP', amount: 14500, fileName: 'orcamento-marmores.pdf', status: 'pendente', studioNote: 'Quartzo branco para bancadas. Aguardo sua aprovação.', comments: [], decidedAt: null, contact: '', deadline: '', payment: '', contractStatus: 'a_iniciar', notes: '' },
  ],
  events: [
    { id: 'e1', projectId: 'p2', date: '2026-06-26', title: 'Envio do contrato', kind: 'evento' },
  ],
};
