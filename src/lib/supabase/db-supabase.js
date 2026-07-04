/* --------------------- data layer (Supabase) --------------------------
   Espelho ASSÍNCRONO da interface de src/lib/db.js (makeDb). Cada leitura
   devolve uma Promise; as mutações fazem insert/update/delete. Os SELECTs
   usam aliases (alias:coluna) para devolver os objetos em camelCase,
   idênticos aos do mock — assim os componentes não precisam mudar.

   Segurança: garantida por RLS no banco (ver schema.sql). Criação de
   usuário de cliente (addProject) NÃO usa service_role no front — chama a
   Edge Function "invite-client" (ver supabase/functions/invite-client).
   --------------------------------------------------------------------- */
import { getSupabase } from './client.js';
import { addMonthsISO, todayISO, fmt, stageOverdue } from '../helpers.js';

const STAGE_COLS =
  'id, projectId:project_id, ord, title, category, status, owner, start, "end", "time", link, presencial, "desc", rescheduledFrom:rescheduled_from, subs:stage_subs(id, title, done)';
const PROJECT_COLS =
  'id, code, name, clientId:client_id, status, address, start, due, completedAt:completed_at, accessUntil:access_until';
const QUOTE_COLS =
  'id, projectId:project_id, segment, supplier, amount, fileName:file_name, status, studioNote:studio_note, decidedAt:decided_at, contact, deadline, payment, contractStatus:contract_status, notes, storagePath:storage_path, comments:quote_comments(author, body, at)';
const CONTRACT_COLS =
  'id, projectId:project_id, name, sigStatus:sig_status, provider, signer, signedAt:signed_at, kind';

const must = (error) => {
  if (error) throw error;
};
const num = (v) => (v == null ? v : Number(v));

export function makeSupabaseDb() {
  const supabase = getSupabase();
  if (!supabase)
    throw new Error('Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');

  const sortByOrd = (rows) => rows.sort((a, b) => a.ord - b.ord);

  const db = {
    /* ------------------------------ auth ------------------------------ */
    login: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) return null;
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, name')
        .eq('id', data.user.id)
        .single();
      if (!profile) return null;
      return { id: profile.id, role: profile.role, name: profile.name };
    },
    logout: () => supabase.auth.signOut(),
    user: async (id) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, name, email')
        .eq('id', id)
        .single();
      must(error);
      return data;
    },

    /* ---------------------------- leituras ---------------------------- */
    projects: async () => {
      const { data, error } = await supabase.from('projects').select(PROJECT_COLS).order('code');
      must(error);
      return data;
    },
    projectsForClient: async (cid) => {
      const { data, error } = await supabase
        .from('projects')
        .select(PROJECT_COLS)
        .eq('client_id', cid)
        .order('code');
      must(error);
      return data;
    },
    project: async (pid) => {
      const { data, error } = await supabase
        .from('projects')
        .select(PROJECT_COLS)
        .eq('id', pid)
        .single();
      must(error);
      return data;
    },
    clientName: async (pid) => {
      const { data, error } = await supabase
        .from('projects')
        .select('client:profiles!projects_client_id_fkey(name)')
        .eq('id', pid)
        .single();
      if (error || !data || !data.client) return '—';
      return data.client.name || '—';
    },
    templates: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('id, name, items:template_items(title, category, "desc", ord)')
        .order('created_at');
      must(error);
      return (data || []).map((t) => ({
        id: t.id,
        name: t.name,
        items: (t.items || [])
          .slice()
          .sort((a, b) => (a.ord || 0) - (b.ord || 0))
          .map(({ title, category, desc }) => ({ title, category, desc })),
      }));
    },
    stages: async (pid) => {
      const { data, error } = await supabase
        .from('stages')
        .select(STAGE_COLS)
        .eq('project_id', pid)
        .order('ord');
      must(error);
      return sortByOrd(data || []);
    },
    documents: async (pid) => {
      const { data, error } = await supabase
        .from('documents')
        .select('id, projectId:project_id, name, type, size, date, storagePath:storage_path')
        .eq('project_id', pid);
      must(error);
      return data;
    },
    contracts: async (pid) => {
      const { data, error } = await supabase
        .from('contracts')
        .select(CONTRACT_COLS)
        .eq('project_id', pid)
        .order('kind', { ascending: true })
        .order('name', { ascending: true });
      must(error);
      return data || [];
    },
    payment: async (pid) => {
      const { data, error } = await supabase
        .from('payments')
        .select(
          'id, projectId:project_id, total, installments(n, amount, due, status, paidAt:paid_at)',
        )
        .eq('project_id', pid)
        .maybeSingle();
      must(error);
      if (!data) return undefined;
      return {
        ...data,
        total: num(data.total),
        installments: (data.installments || [])
          .map((i) => ({ ...i, amount: num(i.amount) }))
          .sort((a, b) => a.n - b.n),
      };
    },
    quotes: async (pid) => {
      const { data, error } = await supabase
        .from('quotes')
        .select(QUOTE_COLS)
        .eq('project_id', pid);
      must(error);
      return (data || []).map((q) => ({ ...q, amount: num(q.amount), comments: q.comments || [] }));
    },
    suppliers: async (pid) => {
      const { data, error } = await supabase
        .from('quotes')
        .select(QUOTE_COLS)
        .eq('project_id', pid)
        .eq('status', 'aprovado');
      must(error);
      return (data || []).map((q) => ({ ...q, amount: num(q.amount), comments: q.comments || [] }));
    },

    /* --------------- leituras derivadas (replicam o makeDb) ----------- */
    calendarEvents: async (pid) => {
      const out = [];
      const [{ data: stages }, payRes, projRes, { data: events }] = await Promise.all([
        supabase
          .from('stages')
          .select('title, category, status, owner, start, "end", "time", link, presencial')
          .eq('project_id', pid),
        supabase
          .from('payments')
          .select('installments(n, due)')
          .eq('project_id', pid)
          .maybeSingle(),
        supabase.from('projects').select('due').eq('id', pid).single(),
        supabase.from('events').select('date, title, kind').eq('project_id', pid),
      ]);
      (stages || []).forEach((s) => {
        const extra = { time: s.time || '', link: s.link || '', presencial: !!s.presencial };
        if (s.category === 'Reunião' && s.start)
          out.push({ date: s.start, title: s.title, kind: 'reuniao', ...extra });
        else if (s.category === 'Entrega' && (s.end || s.start))
          out.push({ date: s.end || s.start, title: s.title, kind: 'entrega' });
        else if (s.category === 'Visita técnica' && s.start)
          out.push({ date: s.start, title: s.title, kind: 'visita', time: s.time || '' });
        if (s.owner === 'client' && s.end && s.status !== 'concluida')
          out.push({
            date: s.end,
            title: s.title + ' — prazo do cliente',
            kind: stageOverdue(s) ? 'atraso' : 'prazo',
          });
      });
      const insts = (payRes.data && payRes.data.installments) || [];
      insts
        .slice()
        .sort((a, b) => a.n - b.n)
        .forEach((i) =>
          out.push({
            date: i.due,
            title: 'Parcela ' + i.n + '/' + insts.length,
            kind: 'pagamento',
          }),
        );
      if (projRes.data && projRes.data.due)
        out.push({ date: projRes.data.due, title: 'Entrega prevista', kind: 'entrega' });
      (events || []).forEach((e) =>
        out.push({ date: e.date, title: e.title, kind: e.kind || 'evento' }),
      );
      return out;
    },
    notifications: async () => {
      const out = [];
      const [{ data: stages }, { data: quotes }, { data: contracts }, { data: projects }] =
        await Promise.all([
          supabase.from('stages').select('id, project_id, title, owner, status, "end"'),
          supabase.from('quotes').select('id, project_id, supplier, segment, status, decided_at'),
          supabase.from('contracts').select('id, project_id, kind, name, sig_status, signer, signed_at'),
          supabase.from('projects').select('id, name, client_id'),
        ]);
      const projById = Object.fromEntries((projects || []).map((p) => [p.id, p]));
      const profileIds = [...new Set((projects || []).map((p) => p.client_id))];
      let profById = {};
      if (profileIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', profileIds);
        profById = Object.fromEntries((profs || []).map((u) => [u.id, u]));
      }
      (stages || []).forEach((st) => {
        const s = { owner: st.owner, status: st.status, end: st.end };
        if (stageOverdue(s)) {
          const p = projById[st.project_id];
          const u = p && profById[p.client_id];
          out.push({
            id: 'n-' + st.id,
            kind: 'atraso',
            projectId: st.project_id,
            projectName: p ? p.name : '',
            title: 'Etapa do cliente em atraso',
            body:
              '"' +
              st.title +
              '" venceu em ' +
              fmt(st.end) +
              '. E-mail de cobrança enviado para ' +
              (u ? u.email : 'o cliente') +
              '.',
            date: st.end,
          });
        }
      });
      (quotes || []).forEach((q) => {
        if (q.decided_at && (q.status === 'aprovado' || q.status === 'reprovado')) {
          const p = projById[q.project_id];
          out.push({
            id: 'n-' + q.id,
            kind: q.status === 'aprovado' ? 'ok' : 'reprovado',
            projectId: q.project_id,
            projectName: p ? p.name : '',
            title:
              'Orçamento ' + (q.status === 'aprovado' ? 'aprovado' : 'reprovado') + ' pelo cliente',
            body: q.supplier + ' · ' + q.segment,
            date: q.decided_at,
          });
        }
      });
      (contracts || []).forEach((c) => {
        if (c.sig_status === 'assinado') {
          const p = projById[c.project_id];
          out.push({
            id: 'n-' + c.id,
            kind: 'ok',
            projectId: c.project_id,
            projectName: p ? p.name : '',
            title: c.kind === 'termo' ? 'Termo assinado' : 'Contrato assinado',
            body: c.name + (c.signer ? ' · ' + c.signer : ''),
            date: c.signed_at || todayISO(),
          });
        }
      });
      return out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    },

    /* ----------------------------- Storage ---------------------------- */
    /** Gera signed URL p/ abrir/baixar um arquivo do bucket privado. */
    fileUrl: async (storagePath) => {
      if (!storagePath) return null;
      const { data, error } = await supabase.storage
        .from('documentos')
        .createSignedUrl(storagePath, 60);
      if (error) throw error;
      return data.signedUrl;
    },

    /* ---------------------------- mutações ---------------------------- */
    addProject: async (data) => {
      // 1) cria o login do cliente via Edge Function (service_role no servidor)
      const { data: fn, error: fnErr } = await supabase.functions.invoke('invite-client', {
        body: { email: data.clientEmail.trim().toLowerCase(), name: data.clientName },
      });
      if (fnErr) throw fnErr;
      const clientId = fn && fn.userId;
      if (!clientId) throw new Error('Falha ao criar o usuário do cliente.');
      // 2) projeto
      const { data: proj, error: pErr } = await supabase
        .from('projects')
        .insert({
          code: data.code,
          name: data.name,
          client_id: clientId,
          status: 'em_andamento',
          address: data.address || null,
          start: data.start || null,
          due: data.due || null,
        })
        .select('id')
        .single();
      must(pErr);
      // 3) contrato em rascunho
      const { error: cErr } = await supabase.from('contracts').insert({
        project_id: proj.id,
        kind: 'contrato',
        name: 'Contrato de prestação de serviços',
        sig_status: 'rascunho',
      });
      must(cErr);
      // devolve o link de acesso e se o e-mail de convite foi enviado
      return {
        id: proj.id,
        inviteLink: (fn && fn.actionLink) || null,
        inviteEmailSent: !!(fn && fn.emailSent),
      };
    },

    addStage: async (pid, d) => {
      const { data: rows, error: e1 } = await supabase
        .from('stages')
        .select('ord')
        .eq('project_id', pid)
        .order('ord', { ascending: false })
        .limit(1);
      must(e1);
      const ord = (rows && rows[0] ? rows[0].ord : 0) + 1;
      const { error } = await supabase.from('stages').insert({
        project_id: pid,
        ord,
        title: d.title,
        category: d.category,
        status: 'a_fazer',
        owner: d.owner || 'studio',
        start: d.start || null,
        end: d.end || null,
        time: d.time || null,
        link: d.link || null,
        presencial: !!d.presencial,
        desc: d.desc || null,
        rescheduled_from: null,
      });
      must(error);
    },
    deleteStage: async (sid) => {
      const { error } = await supabase.from('stages').delete().eq('id', sid);
      must(error);
    },
    updateStage: async (sid, patch) => {
      const map = {
        title: 'title',
        category: 'category',
        owner: 'owner',
        start: 'start',
        end: 'end',
        time: 'time',
        link: 'link',
        presencial: 'presencial',
        desc: 'desc',
        status: 'status',
      };
      const payload = {};
      for (const k of Object.keys(patch))
        if (map[k]) payload[map[k]] = patch[k] === '' ? null : patch[k];
      if ('presencial' in patch) payload.presencial = !!patch.presencial;
      const { error } = await supabase.from('stages').update(payload).eq('id', sid);
      must(error);
    },
    rescheduleStage: async (sid, newEnd) => {
      const { data: cur, error: e1 } = await supabase
        .from('stages')
        .select('"end", rescheduled_from')
        .eq('id', sid)
        .single();
      must(e1);
      const { error } = await supabase
        .from('stages')
        .update({ rescheduled_from: cur.rescheduled_from || cur.end, end: newEnd })
        .eq('id', sid);
      must(error);
    },
    setStageStatus: async (sid, status) => {
      const { error } = await supabase.from('stages').update({ status }).eq('id', sid);
      must(error);
    },
    addSub: async (sid, title) => {
      const { error } = await supabase
        .from('stage_subs')
        .insert({ stage_id: sid, title, done: false });
      must(error);
    },
    toggleSub: async (sid, bid) => {
      const { data: cur, error: e1 } = await supabase
        .from('stage_subs')
        .select('done')
        .eq('id', bid)
        .single();
      must(e1);
      const { error } = await supabase.from('stage_subs').update({ done: !cur.done }).eq('id', bid);
      must(error);
    },
    deleteSub: async (sid, bid) => {
      const { error } = await supabase.from('stage_subs').delete().eq('id', bid);
      must(error);
    },
    applyTemplate: async (pid, tid) => {
      const { data: items, error: e1 } = await supabase
        .from('template_items')
        .select('title, category, "desc", ord')
        .eq('template_id', tid)
        .order('ord');
      must(e1);
      if (!items || !items.length) return;
      const { data: rows, error: e2 } = await supabase
        .from('stages')
        .select('ord')
        .eq('project_id', pid)
        .order('ord', { ascending: false })
        .limit(1);
      must(e2);
      let ord = rows && rows[0] ? rows[0].ord : 0;
      const payload = items.map((it) => ({
        project_id: pid,
        ord: ++ord,
        title: it.title,
        category: it.category,
        status: 'a_fazer',
        owner: 'studio',
        start: null,
        end: null,
        time: null,
        link: null,
        presencial: false,
        desc: it.desc || null,
        rescheduled_from: null,
      }));
      const { error } = await supabase.from('stages').insert(payload);
      must(error);
    },
    addTemplate: async (name, items) => {
      const { data: t, error: e1 } = await supabase
        .from('templates')
        .insert({ name })
        .select('id')
        .single();
      must(e1);
      const payload = items.map((it, i) => ({
        template_id: t.id,
        title: it.title,
        category: it.category,
        desc: it.desc || null,
        ord: i + 1,
      }));
      const { error } = await supabase.from('template_items').insert(payload);
      must(error);
    },
    addDocument: async (pid, d, file) => {
      let storage_path = null;
      if (file) {
        const path = pid + '/' + Date.now() + '-' + file.name;
        const { error: upErr } = await supabase.storage.from('documentos').upload(path, file);
        if (upErr) throw upErr;
        storage_path = path;
      }
      const { error } = await supabase.from('documents').insert({
        project_id: pid,
        name: d.name,
        type: d.type,
        size: d.size,
        date: todayISO(),
        storage_path,
      });
      must(error);
    },
    deleteDocument: async (did) => {
      const { data: doc } = await supabase
        .from('documents')
        .select('storage_path')
        .eq('id', did)
        .single();
      if (doc && doc.storage_path)
        await supabase.storage.from('documentos').remove([doc.storage_path]);
      const { error } = await supabase.from('documents').delete().eq('id', did);
      must(error);
    },
    setContract: async (cid, patch) => {
      const map = {
        sigStatus: 'sig_status',
        provider: 'provider',
        signer: 'signer',
        signedAt: 'signed_at',
      };
      const payload = {};
      for (const k of Object.keys(patch)) if (map[k]) payload[map[k]] = patch[k];
      const { error } = await supabase.from('contracts').update(payload).eq('id', cid);
      must(error);
    },
    addContractDoc: async (pid, d) => {
      const { error } = await supabase.from('contracts').insert({
        project_id: pid,
        kind: d.kind || 'termo',
        name: d.name,
        sig_status: 'rascunho',
      });
      must(error);
    },
    createPlan: async (pid, total, n, firstDue, interval) => {
      const per = Math.round((total / n) * 100) / 100;
      await supabase.from('payments').delete().eq('project_id', pid);
      const { data: pay, error: e1 } = await supabase
        .from('payments')
        .insert({ project_id: pid, total })
        .select('id')
        .single();
      must(e1);
      const payload = Array.from({ length: n }, (_, i) => ({
        payment_id: pay.id,
        n: i + 1,
        amount: per,
        due: addMonthsISO(firstDue, i * interval),
        status: 'pendente',
        paid_at: null,
      }));
      const { error } = await supabase.from('installments').insert(payload);
      must(error);
    },
    markPaid: async (pid, n) => {
      const { data: pay, error: e1 } = await supabase
        .from('payments')
        .select('id')
        .eq('project_id', pid)
        .single();
      must(e1);
      const { error } = await supabase
        .from('installments')
        .update({ status: 'pago', paid_at: todayISO() })
        .eq('payment_id', pay.id)
        .eq('n', n);
      must(error);
    },
    addQuote: async (pid, d, file) => {
      let storage_path = null;
      if (file) {
        const path = pid + '/quotes/' + Date.now() + '-' + file.name;
        const { error: upErr } = await supabase.storage.from('documentos').upload(path, file);
        if (upErr) throw upErr;
        storage_path = path;
      }
      const { error } = await supabase.from('quotes').insert({
        project_id: pid,
        segment: d.segment,
        supplier: d.supplier,
        amount: Number(d.amount),
        file_name: d.fileName || null,
        status: 'pendente',
        studio_note: d.studioNote || null,
        decided_at: null,
        contact: '',
        deadline: '',
        payment: '',
        contract_status: 'a_iniciar',
        notes: '',
        storage_path,
      });
      must(error);
    },
    updateQuote: async (qid, patch) => {
      const map = {
        contact: 'contact',
        deadline: 'deadline',
        payment: 'payment',
        contractStatus: 'contract_status',
        notes: 'notes',
        segment: 'segment',
        supplier: 'supplier',
        amount: 'amount',
        fileName: 'file_name',
        studioNote: 'studio_note',
        status: 'status',
      };
      const payload = {};
      for (const k of Object.keys(patch)) if (map[k]) payload[map[k]] = patch[k];
      const { error } = await supabase.from('quotes').update(payload).eq('id', qid);
      must(error);
    },
    deleteQuote: async (qid) => {
      const { error } = await supabase.from('quotes').delete().eq('id', qid);
      must(error);
    },
    setQuoteStatus: async (qid, status) => {
      const { error } = await supabase
        .from('quotes')
        .update({ status, decided_at: todayISO() })
        .eq('id', qid);
      must(error);
    },
    setQuoteNote: async (qid, note) => {
      const { error } = await supabase.from('quotes').update({ studio_note: note }).eq('id', qid);
      must(error);
    },
    addComment: async (qid, author, body) => {
      const { error } = await supabase
        .from('quote_comments')
        .insert({ quote_id: qid, author, body });
      must(error);
    },
    addEvent: async (pid, d) => {
      const { error } = await supabase
        .from('events')
        .insert({ project_id: pid, date: d.date, title: d.title, kind: d.kind || 'evento' });
      must(error);
    },
    completeProject: async (pid) => {
      const { error } = await supabase
        .from('projects')
        .update({
          status: 'concluido',
          completed_at: todayISO(),
          access_until: addMonthsISO(todayISO(), 1),
        })
        .eq('id', pid);
      must(error);
    },
  };

  return db;
}
