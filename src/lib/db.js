import { calcularPendencias } from './pendencias.js';
/* ------------------------------- db -----------------------------------
   Camada de dados MOCK em memória (não persiste entre sessões).
   A interface aqui é a "fonte da verdade" que o backend real deve espelhar
   — ver src/lib/supabase/db-supabase.js para o esqueleto equivalente e
   src/lib/supabase/schema.sql para o schema das tabelas.
   --------------------------------------------------------------------- */
import { uid, addMonthsISO, todayISO, fmt, stageOverdue } from './helpers.js';

// sub-etapa no formato guardado (igual ao do modo Supabase)
const novaSub = (b) => ({
  id: uid('sb'), title: String(b.title).trim(), done: false, kind: b.kind || 'tarefa',
  kindLabel: b.kind === 'outro' ? String(b.kindLabel || '').trim().slice(0, 40) : '',
  responsible: b.responsible || 'studio', due: b.due || '', time: b.time || '', format: b.format || '', link: b.link || '',
  pedeArquivos: !!b.pedeArquivos, instructions: String(b.instructions || '').trim().slice(0, 600), clientNote: '', entregueEm: null,
});
const camposProjeto = (d) => ({
  address: d.address || '', addressComplement: d.addressComplement || '', neighborhood: d.neighborhood || '',
  city: d.city || '', state: d.state || '', cep: d.cep || '', greeting: (d.greeting || '').trim(),
  start: d.start || '', due: d.due || '',
  ...(d.clientName !== undefined ? { clientName: String(d.clientName || '').trim() } : {}),
});

/* Etapas a partir de itens de template (com sub-etapas), no fim da linha do
   tempo do projeto — mesmo comportamento do modo Supabase. */
function etapasDeItens(state, pid, itens) {
  let ord = state.stages.filter((x) => x.projectId === pid).reduce((m, x) => Math.max(m, x.ord), 0);
  return (itens || [])
    .filter((it) => it && String(it.title || '').trim())
    .map((it) => ({
      id: uid('s'), projectId: pid, ord: ++ord, title: String(it.title).trim(), category: it.category || 'Etapa',
      status: 'a_fazer', owner: 'studio', start: '', end: '', time: '', link: '', presencial: false, desc: it.desc || '',
      subs: (it.subs || [])
        .filter((b) => b && String(b.title || '').trim())
        .map((b) => novaSub({ ...b, due: '', time: '', format: '', link: '' })),
      rescheduledFrom: null,
    }));
}

export function makeDb(state, set) {
  const byP = (arr, pid) => state[arr].filter((x) => x.projectId === pid);
  return {
    login: (email, pass) =>
      // supabase: supabase.auth.signInWithPassword({ email, password })
      state.users.find((u) => u.email === email.trim().toLowerCase() && u.pass === pass) || null,
    user: (id) => state.users.find((u) => u.id === id),
    projects: () => state.projects,
    projectsForClient: (cid) => state.projects.filter((p) => p.clientId === cid),
    project: (pid) => state.projects.find((p) => p.id === pid),
    clientName: (pid) => {
      const p = state.projects.find((x) => x.id === pid);
      const u = p && state.users.find((x) => x.id === p.clientId);
      return (p && p.clientName) || (u ? u.name : '—');
    },
    templates: () => state.templates,
    stages: (pid) => byP('stages', pid).sort((a, b) => a.ord - b.ord),
    documents: (pid) => byP('documents', pid),
    contracts: (pid) => state.contracts.filter((c) => c.projectId === pid),
    payment: (pid) => state.payments.find((x) => x.projectId === pid),
    quotes: (pid) => byP('quotes', pid),
    pendencias: (role, uid) => {
      const meus = role === 'studio' ? state.projects : state.projects.filter((p) => p.clientId === uid);
      const ids = new Set(meus.map((p) => p.id));
      const doProjeto = (lista) => (lista || []).filter((x) => ids.has(x.projectId));
      return calcularPendencias({
        role,
        projects: meus,
        stages: doProjeto(state.stages),
        documents: doProjeto(state.documents),
        contracts: doProjeto(state.contracts),
        quotes: doProjeto(state.quotes),
        arquivos: doProjeto(state.subArquivos),
      });
    },
    subArquivos: (pid) => (state.subArquivos || []).filter((a) => a.projectId === pid),
    fornecedores: () => (state.fornecedores || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    suppliers: (pid) => byP('quotes', pid).filter((q) => q.status === 'aprovado'),
    calendarEvents: (pid) => {
      const out = [];
      byP('stages', pid).forEach((s) => {
        const extra = { time: s.time || '', link: s.link || '', presencial: !!s.presencial };
        if (s.category === 'Reunião' && s.start) out.push({ date: s.start, title: s.title, kind: 'reuniao', ...extra });
        else if (s.category === 'Entrega' && (s.end || s.start)) out.push({ date: s.end || s.start, title: s.title, kind: 'entrega' });
        else if (s.category === 'Visita técnica' && s.start) out.push({ date: s.start, title: s.title, kind: 'visita', time: s.time || '' });
        if (s.owner === 'client' && s.end && s.status !== 'concluida') out.push({ date: s.end, title: s.title + ' — prazo do cliente', kind: stageOverdue(s) ? 'atraso' : 'prazo' });
        (s.subs || []).forEach((b) => {
          if (b.kind === 'reuniao' && b.due) out.push({ date: b.due, title: b.title, kind: 'reuniao', time: b.time || '', link: b.link || '', presencial: b.format === 'presencial' });
          else if (b.kind === 'visita' && b.due) out.push({ date: b.due, title: b.title, kind: 'visita', time: b.time || '' });
          else if (b.kind === 'entrega' && b.due) out.push({ date: b.due, title: b.title, kind: 'entrega' });
        });
      });
      const pay = state.payments.find((x) => x.projectId === pid);
      if (pay) pay.installments.forEach((i) => out.push({ date: i.due, title: 'Parcela ' + i.n + '/' + pay.installments.length, kind: 'pagamento' }));
      const p = state.projects.find((x) => x.id === pid);
      if (p && p.due) out.push({ date: p.due, title: 'Entrega prevista', kind: 'entrega' });
      byP('events', pid).forEach((e) => out.push({ date: e.date, title: e.title, kind: e.kind || 'evento', time: e.time || '', link: e.link || '' }));
      return out;
    },

    /* mutações — trocar por inserts/updates no Supabase */
    addProject: (data) => set((s) => {
      const cid = uid('u');
      const pid = uid('p');
      return {
        ...s,
        users: [...s.users, { id: cid, role: 'client', name: data.clientName, email: data.clientEmail.trim().toLowerCase(), pass: data.pass }],
        projects: [...s.projects, {
          id: pid, code: data.code, name: data.name, clientId: cid, status: 'em_andamento',
          ...camposProjeto(data), completedAt: null, accessUntil: null,
        }],
        stages: [...s.stages, ...etapasDeItens(s, pid, data.etapas)],
      };
    }),
    addStage: (pid, d) => set((s) => {
      const ord = (s.stages.filter((x) => x.projectId === pid).reduce((m, x) => Math.max(m, x.ord), 0)) + 1;
      return { ...s, stages: [...s.stages, { id: uid('s'), projectId: pid, ord, title: d.title, category: d.category, status: 'a_fazer', owner: d.owner || 'studio', start: d.start || '', end: d.end || '', time: d.time || '', link: d.link || '', presencial: !!d.presencial, desc: d.desc || '', subs: (d.subs || []).filter((it) => it && String(it.title || '').trim()).map(novaSub), rescheduledFrom: null }] };
    }),
    deleteStage: (sid) => set((s) => ({ ...s, stages: s.stages.filter((x) => x.id !== sid) })),
    updateStage: (sid, patch) => set((s) => ({ ...s, stages: s.stages.map((x) => x.id === sid ? { ...x, ...patch } : x) })),
    rescheduleStage: (sid, newEnd) => set((s) => ({ ...s, stages: s.stages.map((x) => x.id === sid ? { ...x, rescheduledFrom: x.rescheduledFrom || x.end, end: newEnd } : x) })),
    addSub: (sid, d) => set((s) => { const it = typeof d === 'string' ? { title: d } : d; return { ...s, stages: s.stages.map((x) => x.id === sid ? { ...x, subs: [...(x.subs || []), novaSub(it)] } : x) }; }),
    updateSub: (sid, bid, d) => set((s) => ({ ...s, stages: s.stages.map((x) => x.id === sid ? { ...x, subs: (x.subs || []).map((b) => b.id === bid ? { ...novaSub(d), id: b.id, done: b.done, fileName: b.fileName, storagePath: b.storagePath, clientNote: b.clientNote || '' } : b) } : x) })),
    moveSub: (sid, bid, dir) => set((s) => ({ ...s, stages: s.stages.map((x) => {
      if (x.id !== sid) return x;
      const subs = (x.subs || []).slice();
      const i = subs.findIndex((b) => b.id === bid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= subs.length) return x;
      [subs[i], subs[j]] = [subs[j], subs[i]];
      return { ...x, subs };
    }) })),
    toggleSub: (sid, bid) => set((s) => ({ ...s, stages: s.stages.map((x) => x.id === sid ? { ...x, subs: (x.subs || []).map((b) => b.id === bid ? (b.done ? { ...b, done: false, entregueEm: null } : { ...b, done: true }) : b) } : x) })),
    deleteSub: (sid, bid) => set((s) => ({ ...s, stages: s.stages.map((x) => x.id === sid ? { ...x, subs: (x.subs || []).filter((b) => b.id !== bid) } : x) })),
    attachSubFile: (pid, sid, bid, file) => set((s) => ({ ...s, stages: s.stages.map((x) => x.id === sid ? { ...x, subs: (x.subs || []).map((b) => b.id === bid ? { ...b, fileName: file && file.name ? file.name : 'arquivo' } : b) } : x) })),
    setStageStatus: (sid, status) => set((s) => ({ ...s, stages: s.stages.map((x) => x.id === sid ? { ...x, status } : x) })),
    applyTemplate: (pid, tid) => set((s) => {
      const t = s.templates.find((x) => x.id === tid); if (!t) return s;
      return { ...s, stages: [...s.stages, ...etapasDeItens(s, pid, t.items)] };
    }),
    addTemplate: (name, items) => set((s) => ({ ...s, templates: [...s.templates, { id: uid('t'), name, items }] })),
    deleteTemplate: (tid) => set((s) => ({ ...s, templates: s.templates.filter((t) => t.id !== tid) })),
    updateTemplate: (tid, name, items) => set((s) => ({ ...s, templates: s.templates.map((t) => t.id === tid ? { ...t, name, items } : t) })),
    addDocument: (pid, d) => set((s) => ({ ...s, documents: [...s.documents, { id: uid('d'), projectId: pid, name: d.name, type: d.type, size: d.size, date: todayISO(), approval: d.approval || 'nenhuma', response: null, respondedAt: null, respondedName: null }] })),
    deleteDocument: (did) => set((s) => ({ ...s, documents: s.documents.filter((x) => x.id !== did) })),
    setDocumentApproval: (did, approval) => set((s) => ({ ...s, documents: s.documents.map((x) => x.id === did ? { ...x, approval, response: null, respondedAt: null, respondedName: null, responseNote: null } : x) })),
    updateDocument: (did, d) => set((s) => ({ ...s, documents: s.documents.map((x) => x.id === did ? { ...x, name: String(d.name || '').trim(), type: d.type } : x) })),
    replaceDocumentFile: (pid, did, file) => set((s) => ({ ...s, documents: s.documents.map((x) => x.id === did ? { ...x, size: (file.size / 1048576).toFixed(1).replace('.', ',') + ' MB', date: todayISO() } : x) })),
    // Rodada 4 — espelha responder_etapa e as regras de sub_arquivos do banco
    pedirAprovacaoEtapa: (sid, pedir = true) => set((s) => ({ ...s, stages: s.stages.map((x) => x.id === sid ? { ...x, approval: pedir ? 'pendente' : 'nenhuma', approvalRequestedAt: pedir ? new Date().toISOString() : null, approvalAt: null, approvalName: null, approvalNote: null } : x) })),
    responderEtapa: (sid, decisao, nome, mensagem) => {
      const st = state.stages.find((x) => x.id === sid);
      if (!st || st.approval !== 'pendente') throw new Error('Esta etapa não está aguardando a sua aprovação.');
      const msg = String(mensagem || '').trim();
      const cliente = (state.users.find((u) => u.id === (state.projects.find((p) => p.id === st.projectId) || {}).clientId) || {}).name;
      let patch;
      if (decisao === 'aprovar') {
        if (String(nome || '').trim().length < 3) throw new Error('Digite o seu nome completo para aprovar.');
        patch = { approval: 'aprovada', approvalAt: new Date().toISOString(), approvalName: String(nome).trim(), approvalNote: msg || null };
      } else if (decisao === 'ajustes') {
        if (!msg) throw new Error('Conte o que precisa ser ajustado.');
        patch = { approval: 'ajustes', approvalAt: new Date().toISOString(), approvalName: cliente, approvalNote: msg };
      } else throw new Error('Decisão inválida.');
      set((s) => ({ ...s, stages: s.stages.map((x) => (x.id === sid ? { ...x, ...patch } : x)) }));
    },
    enviarArquivos: (pid, bid, files, sentBy) => {
      const sub = state.stages.flatMap((x) => x.subs || []).find((b) => b.id === bid);
      if (!sub || (sentBy !== 'studio' && (sub.responsible !== 'cliente' || sub.done || sub.entregueEm))) throw new Error('Este pedido não está aberto para envio.');
      const novos = Array.from(files).map((f) => ({ id: uid('ar'), subId: bid, projectId: pid, name: f.name, storagePath: null, size: (f.size / 1048576).toFixed(1).replace('.', ',') + ' MB', sentBy: sentBy === 'studio' ? 'studio' : 'client', createdAt: new Date().toISOString() }));
      set((s) => ({ ...s, subArquivos: [...(s.subArquivos || []), ...novos] }));
    },
    removerArquivo: (pid, aid) => set((s) => ({ ...s, subArquivos: (s.subArquivos || []).filter((a) => a.id !== aid) })),
    // espelha concluir_entrega do banco
    concluirEntrega: (sid, bid) => {
      const sub = state.stages.flatMap((x) => x.subs || []).find((b) => b.id === bid);
      if (!sub || !sub.pedeArquivos || sub.responsible !== 'cliente') throw new Error('Este item não é um pedido de arquivos seu.');
      if (sub.done || sub.entregueEm) throw new Error('Este pedido já foi entregue.');
      if (!(state.subArquivos || []).some((a) => a.subId === bid)) throw new Error('Envie pelo menos um arquivo antes de concluir a entrega.');
      set((s) => ({ ...s, stages: s.stages.map((x) => x.id === sid ? { ...x, subs: (x.subs || []).map((b) => b.id === bid ? { ...b, entregueEm: new Date().toISOString() } : b) } : x) }));
    },
    reabrirPedido: (sid, bid) => set((s) => ({ ...s, stages: s.stages.map((x) => x.id === sid ? { ...x, subs: (x.subs || []).map((b) => b.id === bid ? { ...b, done: false, entregueEm: null } : b) } : x) })),
    setNotaPedido: (sid, bid, nota) => set((s) => ({ ...s, stages: s.stages.map((x) => x.id === sid ? { ...x, subs: (x.subs || []).map((b) => b.id === bid ? { ...b, clientNote: String(nota || '').trim().slice(0, 1000) } : b) } : x) })),
    // no modo demonstração não há e-mail: só confirma que "enviaria"
    avisarCliente: () => ({ emailSent: false, demo: true }),
    // espelha a função responder_documento do banco (mesmas regras)
    responderDocumento: (did, nome, decisao = 'confirmar', mensagem = null) => {
      const d = state.documents.find((x) => x.id === did);
      if (!d || !d.approval || d.approval === 'nenhuma') throw new Error('Este documento não pede resposta.');
      if (d.response) throw new Error('Este documento já foi respondido.');
      const cliente = (state.users.find((u) => u.id === (state.projects.find((p) => p.id === d.projectId) || {}).clientId) || {}).name;
      if (decisao === 'ajustes') {
        const msg = String(mensagem || '').trim();
        if (!msg) throw new Error('Conte o que precisa ser ajustado.');
        set((s) => ({ ...s, documents: s.documents.map((x) => x.id === did ? { ...x, response: 'ajustes', responseNote: msg, respondedAt: new Date().toISOString(), respondedName: cliente } : x) }));
        return;
      }
      if (d.approval === 'assinatura' && String(nome || '').trim().length < 3) throw new Error('Digite o seu nome completo para assinar.');
      const quem = d.approval === 'assinatura' ? String(nome).trim() : (state.users.find((u) => u.id === (state.projects.find((p) => p.id === d.projectId) || {}).clientId) || {}).name;
      set((s) => ({ ...s, documents: s.documents.map((x) => x.id === did ? { ...x, response: d.approval === 'assinatura' ? 'assinado' : 'aprovado', respondedAt: new Date().toISOString(), respondedName: quem } : x) }));
    },
    // espelha a função responder_contrato do banco (mesmas regras)
    responderContrato: (cid, acao, nome, motivo) => {
      const c = state.contracts.find((x) => x.id === cid);
      const metodo = c && (c.method || (c.kind === 'termo' ? 'aceite' : 'autentique'));
      if (!c || c.sigStatus !== 'enviado') throw new Error('Este documento não está aguardando a sua resposta.');
      const p = state.projects.find((x) => x.id === c.projectId);
      const cliente = (state.users.find((u) => u.id === (p || {}).clientId) || {}).name;
      let patch;
      if (acao === 'aprovar' && metodo === 'aceite') patch = { sigStatus: 'assinado', signer: cliente, signedAt: todayISO(), provider: 'Portal', responseNote: null };
      else if (acao === 'recusar' && metodo === 'aceite') patch = { sigStatus: 'recusado', responseNote: String(motivo || '').trim() || null };
      else if (acao === 'assinar' && metodo === 'portal') {
        if (String(nome || '').trim().length < 3) throw new Error('Digite o seu nome completo para assinar.');
        patch = { sigStatus: 'assinado', signer: String(nome).trim(), signedAt: todayISO(), provider: 'Portal', responseNote: null };
      } else throw new Error('Ação não permitida para este documento.');
      set((s) => ({ ...s, contracts: s.contracts.map((x) => x.id === cid ? { ...x, ...patch, respondedAt: new Date().toISOString() } : x) }));
    },
    setContract: (cid, patch) => set((s) => ({ ...s, contracts: s.contracts.map((c) => c.id === cid ? { ...c, ...patch } : c) })),
    updateContractDoc: (pid, cid, d) => set((s) => ({ ...s, contracts: s.contracts.map((c) => c.id === cid ? { ...c, name: String(d.name || '').trim(), body: String(d.body || '').trim() } : c) })),
    addContractDoc: (pid, d) => set((s) => ({ ...s, contracts: [...s.contracts, { id: uid('c'), projectId: pid, kind: d.kind || 'termo', name: d.name, sigStatus: 'rascunho', provider: null, signer: null, signedAt: null, method: d.method || ((d.kind || 'termo') === 'termo' ? 'aceite' : 'autentique'), body: d.body || '', responseNote: null, respondedAt: null }] })),
    deleteContractDoc: (pid, cid) => set((s) => ({ ...s, contracts: s.contracts.filter((c) => c.id !== cid) })),
    sendToAutentique: () => null, // assinatura real só no modo Supabase
    checkAutentique: () => null,
    resendClientAccess: () => null, // só faz sentido no modo Supabase
    createPlan: (pid, total, n, firstDue, interval) => set((s) => {
      const per = Math.round((total / n) * 100) / 100;
      const installments = Array.from({ length: n }, (_, i) => ({ n: i + 1, amount: per, due: addMonthsISO(firstDue, i * interval), status: 'pendente', paidAt: null }));
      const others = s.payments.filter((x) => x.projectId !== pid);
      return { ...s, payments: [...others, { id: uid('pay'), projectId: pid, total, installments }] };
    }),
    markPaid: (pid, n) => set((s) => ({ ...s, payments: s.payments.map((p) => p.projectId === pid ? { ...p, installments: p.installments.map((i) => i.n === n ? { ...i, status: 'pago', paidAt: todayISO() } : i) } : p) })),
    addQuote: (pid, d) => set((s) => ({ ...s, quotes: [...s.quotes, { id: uid('q'), projectId: pid, segment: d.segment, supplier: d.supplier, amount: Number(d.amount), fileName: d.fileName || '', status: 'pendente', studioNote: d.studioNote || '', comments: [], decidedAt: null, contact: d.contact || '', deadline: d.deadline || '', payment: d.payment || '', contractStatus: 'a_iniciar', notes: '' }] })),
    addFornecedor: (d) => set((s) => ({ ...s, fornecedores: [...(s.fornecedores || []), { id: uid('f'), name: String(d.name).trim(), segment: d.segment || '', contact: d.contact || '', phone: d.phone || '', email: d.email || '', notes: d.notes || '' }] })),
    updateFornecedor: (fid, d) => set((s) => ({ ...s, fornecedores: (s.fornecedores || []).map((f) => f.id === fid ? { ...f, ...d, name: String(d.name).trim() } : f) })),
    deleteFornecedor: (fid) => set((s) => ({ ...s, fornecedores: (s.fornecedores || []).filter((f) => f.id !== fid) })),
    // espelha a função decidir_orcamento do banco (mesmas regras)
    decidirOrcamento: (qid, decisao, mensagem) => {
      const q = state.quotes.find((x) => x.id === qid);
      const msg = String(mensagem || '').trim();
      if (!q || q.status !== 'pendente') throw new Error('Este orçamento não está aguardando a sua decisão.');
      const status = { aprovar: 'aprovado', reprovar: 'reprovado', negociar: 'negociacao' }[decisao];
      if (!status) throw new Error('Decisão inválida.');
      if (decisao === 'negociar' && !msg) throw new Error('Conte o que você gostaria de negociar.');
      set((s) => ({ ...s, quotes: s.quotes.map((x) => x.id === qid ? { ...x, status, decidedAt: decisao === 'negociar' ? x.decidedAt : todayISO(), comments: msg ? [...x.comments, { author: 'client', body: msg, at: todayISO() }] : x.comments } : x) }));
    },
    updateQuote: (qid, patch) => set((s) => ({ ...s, quotes: s.quotes.map((q) => q.id === qid ? { ...q, ...patch } : q) })),
    deleteQuote: (qid) => set((s) => ({ ...s, quotes: s.quotes.filter((x) => x.id !== qid) })),
    setQuoteStatus: (qid, status) => set((s) => ({ ...s, quotes: s.quotes.map((q) => q.id === qid ? { ...q, status, decidedAt: todayISO() } : q) })),
    setQuoteNote: (qid, note) => set((s) => ({ ...s, quotes: s.quotes.map((q) => q.id === qid ? { ...q, studioNote: note } : q) })),
    addComment: (qid, author, body) => set((s) => ({ ...s, quotes: s.quotes.map((q) => q.id === qid ? { ...q, comments: [...q.comments, { author, body, at: 'Agora' }] } : q) })),
    addEvent: (pid, d) => set((s) => ({ ...s, events: [...s.events, { id: uid('e'), projectId: pid, date: d.date, title: d.title, kind: d.kind, time: d.time || '', link: d.link || '' }] })),
    updateProject: (pid, d) => set((s) => ({ ...s, projects: s.projects.map((p) => p.id === pid ? { ...p, code: d.code, name: d.name, ...camposProjeto(d) } : p) })),
    deleteProject: (pid) => set((s) => {
      const etapas = new Set(s.stages.filter((x) => x.projectId === pid).map((x) => x.id));
      const novo = { ...s, projects: s.projects.filter((p) => p.id !== pid), stages: s.stages.filter((x) => !etapas.has(x.id)) };
      for (const k of ['documents', 'contracts', 'events', 'quotes', 'payments']) {
        if (Array.isArray(s[k])) novo[k] = s[k].filter((x) => x.projectId !== pid);
      }
      return novo;
    }),
    completeProject: (pid) => set((s) => ({ ...s, projects: s.projects.map((p) => p.id === pid ? { ...p, status: 'concluido', completedAt: todayISO(), accessUntil: addMonthsISO(todayISO(), 1) } : p) })),
    notifications: () => {
      const out = [];
      state.stages.forEach((st) => {
        if (stageOverdue(st)) {
          const p = state.projects.find((x) => x.id === st.projectId);
          const u = p && state.users.find((x) => x.id === p.clientId);
          out.push({ id: 'n-' + st.id, kind: 'atraso', projectId: st.projectId, projectName: p ? p.name : '', title: 'Etapa do cliente em atraso', body: '"' + st.title + '" venceu em ' + fmt(st.end) + '. E-mail de cobrança enviado para ' + (u ? u.email : 'o cliente') + '.', date: st.end });
        }
      });
      state.quotes.forEach((q) => {
        if (q.decidedAt && (q.status === 'aprovado' || q.status === 'reprovado')) {
          const p = state.projects.find((x) => x.id === q.projectId);
          out.push({ id: 'n-' + q.id, kind: q.status === 'aprovado' ? 'ok' : 'reprovado', projectId: q.projectId, projectName: p ? p.name : '', title: 'Orçamento ' + (q.status === 'aprovado' ? 'aprovado' : 'reprovado') + ' pelo cliente', body: q.supplier + ' · ' + q.segment, date: q.decidedAt });
        }
      });
      state.contracts.forEach((c) => {
        if (c.sigStatus === 'assinado') {
          const p = state.projects.find((x) => x.id === c.projectId);
          out.push({ id: 'n-' + c.id, kind: 'ok', projectId: c.projectId, projectName: p ? p.name : '', title: c.kind === 'termo' ? 'Termo assinado' : 'Contrato assinado', body: c.name + (c.signer ? ' · ' + c.signer : ''), date: c.signedAt || todayISO() });
        }
      });
      return out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    },
  };
}
