/* ------------------------------- db -----------------------------------
   Camada de dados MOCK em memória (não persiste entre sessões).
   A interface aqui é a "fonte da verdade" que o backend real deve espelhar
   — ver src/lib/supabase/db-supabase.js para o esqueleto equivalente e
   src/lib/supabase/schema.sql para o schema das tabelas.
   --------------------------------------------------------------------- */
import { uid, addMonthsISO, todayISO, fmt, stageOverdue } from './helpers.js';

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
      return u ? u.name : '—';
    },
    templates: () => state.templates,
    stages: (pid) => byP('stages', pid).sort((a, b) => a.ord - b.ord),
    documents: (pid) => byP('documents', pid),
    contracts: (pid) => state.contracts.filter((c) => c.projectId === pid),
    payment: (pid) => state.payments.find((x) => x.projectId === pid),
    quotes: (pid) => byP('quotes', pid),
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
          else if (b.kind === 'entrega' && b.due) out.push({ date: b.due, title: b.title, kind: 'entrega' });
        });
      });
      const pay = state.payments.find((x) => x.projectId === pid);
      if (pay) pay.installments.forEach((i) => out.push({ date: i.due, title: 'Parcela ' + i.n + '/' + pay.installments.length, kind: 'pagamento' }));
      const p = state.projects.find((x) => x.id === pid);
      if (p && p.due) out.push({ date: p.due, title: 'Entrega prevista', kind: 'entrega' });
      byP('events', pid).forEach((e) => out.push({ date: e.date, title: e.title, kind: e.kind || 'evento' }));
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
          address: data.address, start: data.start, due: data.due, completedAt: null, accessUntil: null,
        }],
        contracts: [...s.contracts, { id: uid('c'), projectId: pid, kind: 'contrato', name: 'Contrato de prestação de serviços', sigStatus: 'rascunho', provider: null, signer: null, signedAt: null }],
      };
    }),
    addStage: (pid, d) => set((s) => {
      const ord = (s.stages.filter((x) => x.projectId === pid).reduce((m, x) => Math.max(m, x.ord), 0)) + 1;
      return { ...s, stages: [...s.stages, { id: uid('s'), projectId: pid, ord, title: d.title, category: d.category, status: 'a_fazer', owner: d.owner || 'studio', start: d.start || '', end: d.end || '', time: d.time || '', link: d.link || '', presencial: !!d.presencial, desc: d.desc || '', subs: (d.subs || []).map((it) => ({ id: uid('sb'), title: it.title, done: false, kind: it.kind || 'tarefa', responsible: it.responsible || 'studio', due: it.due || '', time: it.time || '', format: it.format || '', link: it.link || '' })), rescheduledFrom: null }] };
    }),
    deleteStage: (sid) => set((s) => ({ ...s, stages: s.stages.filter((x) => x.id !== sid) })),
    updateStage: (sid, patch) => set((s) => ({ ...s, stages: s.stages.map((x) => x.id === sid ? { ...x, ...patch } : x) })),
    rescheduleStage: (sid, newEnd) => set((s) => ({ ...s, stages: s.stages.map((x) => x.id === sid ? { ...x, rescheduledFrom: x.rescheduledFrom || x.end, end: newEnd } : x) })),
    addSub: (sid, d) => set((s) => { const it = typeof d === 'string' ? { title: d } : d; return { ...s, stages: s.stages.map((x) => x.id === sid ? { ...x, subs: [...(x.subs || []), { id: uid('sb'), title: it.title, done: false, kind: it.kind || 'tarefa', responsible: it.responsible || 'studio', due: it.due || '', time: it.time || '', format: it.format || '', link: it.link || '' }] } : x) }; }),
    toggleSub: (sid, bid) => set((s) => ({ ...s, stages: s.stages.map((x) => x.id === sid ? { ...x, subs: (x.subs || []).map((b) => b.id === bid ? { ...b, done: !b.done } : b) } : x) })),
    deleteSub: (sid, bid) => set((s) => ({ ...s, stages: s.stages.map((x) => x.id === sid ? { ...x, subs: (x.subs || []).filter((b) => b.id !== bid) } : x) })),
    attachSubFile: (pid, sid, bid, file) => set((s) => ({ ...s, stages: s.stages.map((x) => x.id === sid ? { ...x, subs: (x.subs || []).map((b) => b.id === bid ? { ...b, fileName: file && file.name ? file.name : 'arquivo' } : b) } : x) })),
    setStageStatus: (sid, status) => set((s) => ({ ...s, stages: s.stages.map((x) => x.id === sid ? { ...x, status } : x) })),
    applyTemplate: (pid, tid) => set((s) => {
      const t = s.templates.find((x) => x.id === tid); if (!t) return s;
      let ord = s.stages.filter((x) => x.projectId === pid).reduce((m, x) => Math.max(m, x.ord), 0);
      const added = t.items.map((it) => ({ id: uid('s'), projectId: pid, ord: ++ord, title: it.title, category: it.category, status: 'a_fazer', owner: 'studio', start: '', end: '', time: '', link: '', presencial: false, desc: it.desc, subs: [], rescheduledFrom: null }));
      return { ...s, stages: [...s.stages, ...added] };
    }),
    addTemplate: (name, items) => set((s) => ({ ...s, templates: [...s.templates, { id: uid('t'), name, items }] })),
    deleteTemplate: (tid) => set((s) => ({ ...s, templates: s.templates.filter((t) => t.id !== tid) })),
    addDocument: (pid, d) => set((s) => ({ ...s, documents: [...s.documents, { id: uid('d'), projectId: pid, name: d.name, type: d.type, size: d.size, date: todayISO() }] })),
    deleteDocument: (did) => set((s) => ({ ...s, documents: s.documents.filter((x) => x.id !== did) })),
    setContract: (cid, patch) => set((s) => ({ ...s, contracts: s.contracts.map((c) => c.id === cid ? { ...c, ...patch } : c) })),
    addContractDoc: (pid, d) => set((s) => ({ ...s, contracts: [...s.contracts, { id: uid('c'), projectId: pid, kind: d.kind || 'termo', name: d.name, sigStatus: 'rascunho', provider: null, signer: null, signedAt: null }] })),
    deleteContractDoc: (pid, cid) => set((s) => ({ ...s, contracts: s.contracts.filter((c) => c.id !== cid) })),
    resendClientAccess: () => null, // só faz sentido no modo Supabase
    createPlan: (pid, total, n, firstDue, interval) => set((s) => {
      const per = Math.round((total / n) * 100) / 100;
      const installments = Array.from({ length: n }, (_, i) => ({ n: i + 1, amount: per, due: addMonthsISO(firstDue, i * interval), status: 'pendente', paidAt: null }));
      const others = s.payments.filter((x) => x.projectId !== pid);
      return { ...s, payments: [...others, { id: uid('pay'), projectId: pid, total, installments }] };
    }),
    markPaid: (pid, n) => set((s) => ({ ...s, payments: s.payments.map((p) => p.projectId === pid ? { ...p, installments: p.installments.map((i) => i.n === n ? { ...i, status: 'pago', paidAt: todayISO() } : i) } : p) })),
    addQuote: (pid, d) => set((s) => ({ ...s, quotes: [...s.quotes, { id: uid('q'), projectId: pid, segment: d.segment, supplier: d.supplier, amount: Number(d.amount), fileName: d.fileName || '', status: 'pendente', studioNote: d.studioNote || '', comments: [], decidedAt: null, contact: '', deadline: '', payment: '', contractStatus: 'a_iniciar', notes: '' }] })),
    updateQuote: (qid, patch) => set((s) => ({ ...s, quotes: s.quotes.map((q) => q.id === qid ? { ...q, ...patch } : q) })),
    deleteQuote: (qid) => set((s) => ({ ...s, quotes: s.quotes.filter((x) => x.id !== qid) })),
    setQuoteStatus: (qid, status) => set((s) => ({ ...s, quotes: s.quotes.map((q) => q.id === qid ? { ...q, status, decidedAt: todayISO() } : q) })),
    setQuoteNote: (qid, note) => set((s) => ({ ...s, quotes: s.quotes.map((q) => q.id === qid ? { ...q, studioNote: note } : q) })),
    addComment: (qid, author, body) => set((s) => ({ ...s, quotes: s.quotes.map((q) => q.id === qid ? { ...q, comments: [...q.comments, { author, body, at: 'Agora' }] } : q) })),
    addEvent: (pid, d) => set((s) => ({ ...s, events: [...s.events, { id: uid('e'), projectId: pid, date: d.date, title: d.title, kind: d.kind }] })),
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
