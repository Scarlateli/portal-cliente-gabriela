import { calcularPendencias } from '../pendencias.js';
import { agendaGeral } from '../agendaStudio.js';
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
  'id, projectId:project_id, ord, title, category, status, owner, start, "end", "time", link, presencial, "desc", rescheduledFrom:rescheduled_from, approval, approvalRequestedAt:approval_requested_at, approvalAt:approval_at, approvalName:approval_name, approvalNote:approval_note, subs:stage_subs(id, ord, title, done, kind, kindLabel:kind_label, responsible, due, time, format, link, pedeArquivos:pede_arquivos, instructions, clientNote:client_note, entregueEm:entregue_em, storagePath:storage_path, fileName:file_name)';
const PROJECT_COLS =
  'id, code, name, clientId:client_id, status, address, addressComplement:address_complement, neighborhood, city, state, cep, greeting, start, due, completedAt:completed_at, accessUntil:access_until';
const QUOTE_COLS =
  'id, projectId:project_id, segment, supplier, amount, fileName:file_name, status, studioNote:studio_note, decidedAt:decided_at, contact, deadline, payment, contractStatus:contract_status, notes, storagePath:storage_path, comments:quote_comments(author, body, at)';
const CONTRACT_COLS =
  'id, projectId:project_id, name, sigStatus:sig_status, provider, signer, signedAt:signed_at, kind, storagePath:storage_path, providerDocId:provider_doc_id, studioSignLink:studio_sign_link, method, body, responseNote:response_note, respondedAt:responded_at, stageId:stage_id';

const fornecedorRow = (d) => ({
  name: String(d.name || '').trim(),
  segment: d.segment || null,
  contact: d.contact || null,
  phone: d.phone || null,
  email: d.email || null,
  notes: d.notes || null,
});

const must = (error) => {
  if (error) throw error;
};
const num = (v) => (v == null ? v : Number(v));

export function makeSupabaseDb() {
  const supabase = getSupabase();
  if (!supabase)
    throw new Error('Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');

  const sortByOrd = (rows) => rows.sort((a, b) => a.ord - b.ord);
  // sub-etapas na ordem definida pelo studio (empate: ordem de gravação)
  const ordenarSubs = (stages) => {
    (stages || []).forEach((st) => st.subs && st.subs.sort((a, b) => (a.ord || 0) - (b.ord || 0)));
    return stages;
  };
  const linhaSub = (stageId, b, ord) => ({
    stage_id: stageId,
    ord,
    title: String(b.title).trim(),
    kind: b.kind || 'tarefa',
    kind_label: b.kind === 'outro' ? String(b.kindLabel || '').trim().slice(0, 40) || null : null,
    responsible: b.responsible || 'studio',
    due: b.due || null,
    time: b.time || null,
    format: b.format || null,
    link: b.link || null,
    pede_arquivos: !!b.pedeArquivos,
    // descrição curta da sub-etapa; num pedido de arquivos, o que mandar
    instructions: String(b.instructions || '').trim().slice(0, 600) || null,
  });
  // nome de arquivo seguro para o Storage (sem acentos nem símbolos)
  const nomeSeguro = (n) =>
    String(n || 'arquivo')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w.-]+/g, '_')
      .slice(-80);
  // campos de projeto que o cadastro e a edição gravam
  const camposProjeto = (d) => ({
    address: d.address || null,
    address_complement: d.addressComplement || null,
    neighborhood: d.neighborhood || null,
    city: d.city || null,
    state: d.state || null,
    cep: d.cep || null,
    greeting: (d.greeting || '').trim() || null,
    start: d.start || null,
    due: d.due || null,
    // nome do cliente como digitado neste projeto (só grava quando veio)
    ...(d.clientName !== undefined ? { client_name: String(d.clientName || '').trim() || null } : {}),
  });

  // Chama uma Edge Function e devolve o corpo da resposta. Se a função
  // responder 401 (token velho, por exemplo depois de o iPad ficar parado),
  // renova a sessão uma vez e tenta de novo antes de desistir.
  const invocar = async (nome, body) => {
    const chamar = () => supabase.functions.invoke(nome, { body });
    let { data, error } = await chamar();
    const status = error && error.context && error.context.status;
    if (error && status === 401) {
      const { error: rErr } = await supabase.auth.refreshSession();
      if (!rErr) ({ data, error } = await chamar());
    }
    if (error) {
      // FunctionsHttpError traz o Response em .context — extrai o erro real
      let msg = error.message;
      try {
        const corpo = error.context && (await error.context.json());
        if (corpo && corpo.error) msg = corpo.error;
      } catch {
        /* mantém a mensagem genérica */
      }
      throw new Error(msg);
    }
    return data;
  };

  // Cria etapas, cada uma com as suas sub-etapas, no fim da linha do tempo do
  // projeto. Usado ao aplicar um template e ao criar o projeto já com etapas.
  const inserirEtapas = async (pid, itens) => {
    const lista = (itens || []).filter((it) => it && String(it.title || '').trim());
    if (!lista.length) return;
    const { data: ult, error: e1 } = await supabase
      .from('stages')
      .select('ord')
      .eq('project_id', pid)
      .order('ord', { ascending: false })
      .limit(1);
    must(e1);
    let ord = ult && ult[0] ? ult[0].ord : 0;
    const payload = lista.map((it) => ({
      project_id: pid,
      ord: ++ord,
      title: String(it.title).trim(),
      category: it.category || 'Etapa',
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
    const { data: criadas, error: e2 } = await supabase.from('stages').insert(payload).select('id, ord');
    must(e2);
    const porOrd = new Map((criadas || []).map((c) => [c.ord, c.id]));
    const subs = [];
    payload.forEach((etapa, i) => {
      const stageId = porOrd.get(etapa.ord);
      (lista[i].subs || [])
        .filter((b) => b && String(b.title || '').trim())
        .forEach((b, k) => subs.push(linhaSub(stageId, { ...b, due: null, time: null, format: null, link: null }, k + 1)));
    });
    if (subs.length) {
      const { error: e3 } = await supabase.from('stage_subs').insert(subs);
      must(e3);
    }
  };

  // Itens de template sempre no mesmo formato, com a lista de sub-etapas.
  const normalizarItens = (itens) =>
    (itens || [])
      .filter((it) => it && String(it.title || '').trim())
      .map((it, i) => ({
        title: String(it.title).trim(),
        category: it.category || 'Etapa',
        desc: it.desc || null,
        ord: i + 1,
        subs: (it.subs || [])
          .filter((b) => b && String(b.title || '').trim())
          .map((b) => ({
            title: String(b.title).trim(),
            kind: b.kind || 'tarefa',
            kindLabel: b.kind === 'outro' ? String(b.kindLabel || '').trim().slice(0, 40) : '',
            responsible: b.responsible || 'studio',
            pedeArquivos: !!b.pedeArquivos,
            instructions: String(b.instructions || '').trim(),
          })),
      }));

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
    // scope 'local': sair num aparelho não derruba a sessão dos outros
    // (o padrão 'global' encerrava o iPad quando ela saía no computador).
    logout: () => supabase.auth.signOut({ scope: 'local' }),
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
    // nome do cliente deste projeto; projetos antigos caem no nome do perfil
    clientName: async (pid) => {
      const { data, error } = await supabase
        .from('projects')
        .select('client_name, client:profiles!projects_client_id_fkey(name)')
        .eq('id', pid)
        .single();
      if (error || !data) return '—';
      return data.client_name || (data.client && data.client.name) || '—';
    },
    templates: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('id, name, items:template_items(title, category, "desc", ord, subs)')
        .order('created_at');
      must(error);
      return (data || []).map((t) => ({
        id: t.id,
        name: t.name,
        items: (t.items || [])
          .slice()
          .sort((a, b) => (a.ord || 0) - (b.ord || 0))
          .map(({ title, category, desc, subs }) => ({ title, category, desc, subs: subs || [] })),
      }));
    },
    stages: async (pid) => {
      const { data, error } = await supabase
        .from('stages')
        .select(STAGE_COLS)
        .eq('project_id', pid)
        .order('ord');
      must(error);
      return ordenarSubs(sortByOrd(data || []));
    },
    documents: async (pid) => {
      const { data, error } = await supabase
        .from('documents')
        .select(
          'id, projectId:project_id, name, type, size, date, storagePath:storage_path, approval, response, respondedAt:responded_at, respondedName:responded_name, responseNote:response_note',
        )
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
      if (!data) return null; // react-query não aceita undefined
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
    // pendências de quem está logado (Etapa 7). A RLS já limita o cliente
    // aos projetos dele; o studio enxerga todos.
    pendencias: async (role) => {
      const [pr, st, dc, ct, qt, ar] = await Promise.all([
        supabase.from('projects').select('id, code, name, status'),
        supabase
          .from('stages')
          .select(
            'id, projectId:project_id, title, status, owner, "end", approval, subs:stage_subs(id, title, done, responsible, due, pedeArquivos:pede_arquivos)',
          ),
        supabase.from('documents').select('id, projectId:project_id, name, approval, response'),
        supabase.from('contracts').select('id, projectId:project_id, name, kind, method, sigStatus:sig_status'),
        supabase.from('quotes').select('id, projectId:project_id, supplier, segment, status'),
        supabase.from('sub_arquivos').select('subId:sub_id'),
      ]);
      for (const r of [pr, st, dc, ct, qt, ar]) must(r.error);
      return calcularPendencias({
        role,
        projects: pr.data || [],
        stages: st.data || [],
        documents: dc.data || [],
        contracts: ct.data || [],
        quotes: qt.data || [],
        arquivos: ar.data || [],
      });
    },
    // tela "Hoje" do studio: atrasados e próximos 7 dias de todos os projetos
    agendaStudio: async () => {
      const [pr, st, ev] = await Promise.all([
        supabase.from('projects').select('id, name, status'),
        supabase
          .from('stages')
          .select(
            'id, projectId:project_id, title, category, status, owner, start, "end", "time", subs:stage_subs(id, title, done, kind, kindLabel:kind_label, responsible, due, time, format, link, pedeArquivos:pede_arquivos)',
          ),
        supabase.from('events').select('id, projectId:project_id, date, title, kind, time, link'),
      ]);
      for (const r of [pr, st, ev]) must(r.error);
      return agendaGeral({ projects: pr.data || [], stages: st.data || [], events: ev.data || [] });
    },
    // cadastro de fornecedores do studio (Etapa 8); RLS: só o studio lê
    fornecedores: async () => {
      const { data, error } = await supabase
        .from('fornecedores')
        .select('id, name, segment, contact, phone, email, notes')
        .order('name');
      must(error);
      return data || [];
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
          .select('title, category, status, owner, start, "end", "time", link, presencial, subs:stage_subs(title, done, kind, due, time, format, link)')
          .eq('project_id', pid),
        supabase
          .from('payments')
          .select('installments(n, due)')
          .eq('project_id', pid)
          .maybeSingle(),
        supabase.from('projects').select('due').eq('id', pid).single(),
        supabase.from('events').select('date, title, kind, time, link').eq('project_id', pid),
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
        (s.subs || []).forEach((b) => {
          if (b.kind === 'reuniao' && b.due)
            out.push({
              date: b.due,
              title: b.title,
              kind: 'reuniao',
              time: b.time || '',
              link: b.link || '',
              presencial: b.format === 'presencial',
            });
          else if (b.kind === 'visita' && b.due)
            out.push({ date: b.due, title: b.title, kind: 'visita', time: b.time || '' });
          else if (b.kind === 'entrega' && b.due)
            out.push({ date: b.due, title: b.title, kind: 'entrega' });
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
        out.push({ date: e.date, title: e.title, kind: e.kind || 'evento', time: e.time || '', link: e.link || '' }),
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
      // reset: false — se o cliente já tem acesso (outro projeto), a senha
      // dele continua valendo; o projeto novo só aparece no portal dele.
      // Rodada 12: sem e-mail, o projeto nasce sem cliente vinculado e o
      // acesso é liberado depois (liberarAcesso).
      const email = String(data.clientEmail || '').trim().toLowerCase();
      const fn = email
        ? await invocar('invite-client', { email, name: data.clientName, greeting: data.greeting || '', reset: false })
        : null;
      const clientId = fn ? fn.userId : null;
      if (email && !clientId) throw new Error('Falha ao criar o usuário do cliente.');
      // 2) projeto
      const { data: proj, error: pErr } = await supabase
        .from('projects')
        .insert({
          code: data.code,
          name: data.name,
          client_id: clientId,
          status: 'em_andamento',
          ...camposProjeto(data),
        })
        .select('id')
        .single();
      must(pErr);
      // (rodada 5: o projeto não nasce mais com um contrato em rascunho; a
      // Gabriela sobe o contrato assinado quando o cliente fecha)
      // 3) etapas escolhidas no cadastro (template ajustado antes do envio)
      if (data.etapas && data.etapas.length) await inserirEtapas(proj.id, data.etapas);
      // devolve a senha provisória do cliente e se o e-mail foi enviado
      return {
        id: proj.id,
        tempPassword: (fn && fn.tempPassword) || null,
        inviteEmailSent: !!(fn && fn.emailSent),
        jaTinhaAcesso: !!(fn && fn.existing),
      };
    },
    // libera o acesso de um projeto criado sem e-mail (rodada 12)
    liberarAcesso: async (pid, emailDigitado) => {
      const email = String(emailDigitado || '').trim().toLowerCase();
      if (!email) throw new Error('Informe o e-mail do cliente.');
      const { data: proj, error: e1 } = await supabase
        .from('projects')
        .select('client_id, client_name, greeting')
        .eq('id', pid)
        .single();
      must(e1);
      if (proj.client_id) throw new Error('Este projeto já tem acesso liberado.');
      const fn = await invocar('invite-client', {
        email,
        name: proj.client_name || email,
        greeting: proj.greeting || '',
        reset: false,
      });
      if (!fn || !fn.userId) throw new Error('Falha ao criar o acesso do cliente.');
      const { error: e2 } = await supabase.from('projects').update({ client_id: fn.userId }).eq('id', pid);
      must(e2);
      return {
        email,
        tempPassword: fn.tempPassword || null,
        emailSent: !!fn.emailSent,
        jaTinhaAcesso: !!fn.existing,
      };
    },
    resendClientAccess: async (pid) => {
      const { data: proj, error: e1 } = await supabase
        .from('projects')
        .select('client_id')
        .eq('id', pid)
        .single();
      must(e1);
      const { data: prof, error: e2 } = await supabase
        .from('profiles')
        .select('email, name')
        .eq('id', proj.client_id)
        .single();
      must(e2);
      const fn = await invocar('invite-client', { email: prof.email, name: prof.name });
      return {
        email: prof.email,
        tempPassword: (fn && fn.tempPassword) || null,
        emailSent: !!(fn && fn.emailSent),
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
      const { data: st, error } = await supabase.from('stages').insert({
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
      })
        .select('id')
        .single();
      must(error);
      const subs = (d.subs || [])
        .filter((it) => it && String(it.title || '').trim())
        .map((it, k) => linhaSub(st.id, it, k + 1));
      if (subs.length) {
        const { error: e2 } = await supabase.from('stage_subs').insert(subs);
        must(e2);
      }
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
    addSub: async (sid, d) => {
      const it = typeof d === 'string' ? { title: d } : d;
      const { data: ult, error: e1 } = await supabase
        .from('stage_subs')
        .select('ord')
        .eq('stage_id', sid)
        .order('ord', { ascending: false })
        .limit(1);
      must(e1);
      const { error } = await supabase
        .from('stage_subs')
        .insert(linhaSub(sid, it, (ult && ult[0] ? ult[0].ord : 0) + 1));
      must(error);
    },
    updateSub: async (sid, bid, d) => {
      const campos = linhaSub(sid, d, 0);
      delete campos.stage_id; // a sub-etapa não muda de etapa nem de lugar aqui
      delete campos.ord;
      const { error } = await supabase.from('stage_subs').update(campos).eq('id', bid);
      must(error);
    },
    // sobe (-1) ou desce (+1) a sub-etapa, trocando de lugar com a vizinha;
    // regrava a ordem de todas para não depender de empates antigos
    moveSub: async (sid, bid, dir) => {
      const { data: rows, error: e1 } = await supabase
        .from('stage_subs')
        .select('id, ord')
        .eq('stage_id', sid);
      must(e1);
      const lista = (rows || []).slice().sort((a, b) => (a.ord || 0) - (b.ord || 0));
      const i = lista.findIndex((r) => r.id === bid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= lista.length) return;
      [lista[i], lista[j]] = [lista[j], lista[i]];
      for (let k = 0; k < lista.length; k++) {
        if (lista[k].ord === k + 1) continue;
        const { error } = await supabase.from('stage_subs').update({ ord: k + 1 }).eq('id', lista[k].id);
        must(error);
      }
    },
    toggleSub: async (sid, bid) => {
      const { data: cur, error: e1 } = await supabase
        .from('stage_subs')
        .select('done')
        .eq('id', bid)
        .single();
      must(e1);
      // reabrir também devolve a entrega ao cliente
      const { error } = await supabase
        .from('stage_subs')
        .update(cur.done ? { done: false, entregue_em: null } : { done: true })
        .eq('id', bid);
      must(error);
    },
    deleteSub: async (sid, bid) => {
      const { error } = await supabase.from('stage_subs').delete().eq('id', bid);
      must(error);
    },
    attachSubFile: async (pid, sid, bid, file) => {
      const path = pid + '/subetapas/' + Date.now() + '-' + nomeSeguro(file.name);
      const { error: upErr } = await supabase.storage.from('documentos').upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase
        .from('stage_subs')
        .update({ storage_path: path, file_name: file.name })
        .eq('id', bid);
      must(error);
    },
    applyTemplate: async (pid, tid) => {
      const { data: items, error } = await supabase
        .from('template_items')
        .select('title, category, "desc", ord, subs')
        .eq('template_id', tid)
        .order('ord');
      must(error);
      await inserirEtapas(pid, items || []);
    },
    addTemplate: async (name, items) => {
      const { data: t, error: e1 } = await supabase
        .from('templates')
        .insert({ name })
        .select('id')
        .single();
      must(e1);
      const payload = normalizarItens(items).map((it) => ({ template_id: t.id, ...it }));
      if (payload.length) {
        const { error } = await supabase.from('template_items').insert(payload);
        must(error);
      }
    },
    updateTemplate: async (tid, name, items) => {
      const { error: e1 } = await supabase.from('templates').update({ name }).eq('id', tid);
      must(e1);
      // os itens são trocados por inteiro: mais simples e sem item órfão
      const { error: e2 } = await supabase.from('template_items').delete().eq('template_id', tid);
      must(e2);
      const payload = normalizarItens(items).map((it) => ({ template_id: tid, ...it }));
      if (payload.length) {
        const { error: e3 } = await supabase.from('template_items').insert(payload);
        must(e3);
      }
    },
    deleteTemplate: async (tid) => {
      const { error } = await supabase.from('templates').delete().eq('id', tid);
      must(error);
    },
    addDocument: async (pid, d, file) => {
      let storage_path = null;
      if (file) {
        const path = pid + '/' + Date.now() + '-' + nomeSeguro(file.name);
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
        approval: d.approval || 'nenhuma',
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
        method: 'method',
        body: 'body',
        name: 'name',
        responseNote: 'response_note',
        respondedAt: 'responded_at',
      };
      const payload = {};
      for (const k of Object.keys(patch)) if (map[k]) payload[map[k]] = patch[k];
      const { error } = await supabase.from('contracts').update(payload).eq('id', cid);
      must(error);
    },
    /* ---- Etapas 5 e 6: respostas do cliente ----
       O cliente age por funções no banco (responder_documento /
       responder_contrato), que conferem que o registro é dele e alteram só os
       campos daquela ação. O studio continua editando direto. */
    setDocumentApproval: async (did, approval) => {
      const { error } = await supabase
        .from('documents')
        .update({ approval, response: null, responded_at: null, responded_name: null })
        .eq('id', did);
      must(error);
    },
    // decisao: 'confirmar' (OK ou assinatura, conforme o pedido) ou 'ajustes'
    responderDocumento: async (did, nome, decisao = 'confirmar', mensagem = null) => {
      const { error } = await supabase.rpc('confirmar_documento', {
        p_documento: did,
        p_decisao: decisao,
        p_nome: nome || null,
        p_mensagem: mensagem || null,
      });
      must(error);
    },
    updateDocument: async (did, d) => {
      const { error } = await supabase
        .from('documents')
        .update({ name: String(d.name || '').trim(), type: d.type })
        .eq('id', did);
      must(error);
    },
    // troca o arquivo de um documento (mantém nome, categoria e pedido)
    replaceDocumentFile: async (pid, did, file) => {
      const { data: antigo } = await supabase.from('documents').select('storage_path').eq('id', did).maybeSingle();
      const path = pid + '/' + Date.now() + '-' + nomeSeguro(file.name);
      const { error: upErr } = await supabase.storage.from('documentos').upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase
        .from('documents')
        .update({
          storage_path: path,
          size: (file.size / 1048576).toFixed(1).replace('.', ',') + ' MB',
          date: todayISO(),
        })
        .eq('id', did);
      must(error);
      if (antigo && antigo.storage_path) await supabase.storage.from('documentos').remove([antigo.storage_path]);
    },

    /* ---- Rodada 4: aprovação de etapa e envios do cliente ---- */
    pedirAprovacaoEtapa: async (sid, pedir = true) => {
      const { error } = await supabase
        .from('stages')
        .update({
          approval: pedir ? 'pendente' : 'nenhuma',
          approval_requested_at: pedir ? new Date().toISOString() : null,
          approval_at: null,
          approval_name: null,
          approval_note: null,
        })
        .eq('id', sid);
      must(error);
    },
    responderEtapa: async (sid, decisao, nome, mensagem) => {
      const { error } = await supabase.rpc('responder_etapa', {
        p_etapa: sid,
        p_decisao: decisao,
        p_nome: nome || null,
        p_mensagem: mensagem || null,
      });
      must(error);
    },
    subArquivos: async (pid) => {
      const { data, error } = await supabase
        .from('sub_arquivos')
        .select('id, subId:sub_id, projectId:project_id, name, storagePath:storage_path, size, sentBy:sent_by, createdAt:created_at, nota')
        .eq('project_id', pid)
        .order('created_at');
      must(error);
      return data || [];
    },
    // vários arquivos de uma vez para um pedido; quem manda: 'client' | 'studio'
    enviarArquivos: async (pid, bid, files, sentBy) => {
      for (const file of files) {
        const path = pid + '/envios/' + bid + '/' + Date.now() + '-' + nomeSeguro(file.name);
        const { error: upErr } = await supabase.storage.from('documentos').upload(path, file);
        if (upErr) throw upErr;
        const { error } = await supabase.from('sub_arquivos').insert({
          sub_id: bid,
          project_id: pid,
          name: file.name,
          storage_path: path,
          size: (file.size / 1048576).toFixed(1).replace('.', ',') + ' MB',
          sent_by: sentBy === 'studio' ? 'studio' : 'client',
        });
        must(error);
      }
    },
    removerArquivo: async (pid, aid) => {
      const { data: a } = await supabase.from('sub_arquivos').select('storage_path').eq('id', aid).maybeSingle();
      const { error } = await supabase.from('sub_arquivos').delete().eq('id', aid);
      must(error);
      // o studio apaga o arquivo do Storage; o cliente não tem essa permissão
      // (o arquivo fica guardado e some junto com o projeto)
      if (a && a.storage_path) await supabase.storage.from('documentos').remove([a.storage_path]);
    },
    // o cliente avisa que mandou tudo; depois disso não mexe mais no pedido
    concluirEntrega: async (sid, bid) => {
      const { error } = await supabase.rpc('concluir_entrega', { p_sub: bid });
      must(error);
    },
    // o cliente marca como feita uma tarefa dele que não pede arquivos (rodada 12)
    concluirTarefa: async (sid, bid) => {
      const { error } = await supabase.rpc('concluir_tarefa', { p_sub: bid });
      must(error);
    },
    // observação do cliente num arquivo enviado (rodada 12)
    anotarArquivo: async (pid, aid, nota) => {
      const { error } = await supabase.rpc('anotar_arquivo', { p_arquivo: aid, p_nota: nota || '' });
      must(error);
    },
    // o studio devolve o pedido ao cliente (aberto de novo para envio)
    reabrirPedido: async (sid, bid) => {
      const { error } = await supabase.from('stage_subs').update({ done: false, entregue_em: null }).eq('id', bid);
      must(error);
    },
    setNotaPedido: async (sid, bid, nota) => {
      const { error } = await supabase
        .from('stage_subs')
        .update({ client_note: String(nota || '').trim().slice(0, 1000) || null })
        .eq('id', bid);
      must(error);
    },
    // e-mail curto avisando o cliente de que há algo esperando por ele
    avisarCliente: async (pid, texto) => invocar('avisar-cliente', { projectId: pid, texto }),
    responderContrato: async (cid, acao, nome, motivo) => {
      const { error } = await supabase.rpc('responder_contrato', {
        p_contrato: cid,
        p_acao: acao,
        p_nome: nome || null,
        p_motivo: motivo || null,
      });
      must(error);
    },
    // editar termo/contrato: nome, texto e, se vier, um PDF novo no lugar
    updateContractDoc: async (pid, cid, d, file) => {
      const payload = { name: String(d.name || '').trim(), body: String(d.body || '').trim() || null };
      let antigo = null;
      if (file) {
        const { data: c } = await supabase.from('contracts').select('storage_path').eq('id', cid).maybeSingle();
        antigo = c && c.storage_path;
        const path = pid + '/contratos/' + Date.now() + '-' + nomeSeguro(file.name);
        const { error: upErr } = await supabase.storage.from('documentos').upload(path, file);
        if (upErr) throw upErr;
        payload.storage_path = path;
      }
      const { error } = await supabase.from('contracts').update(payload).eq('id', cid);
      must(error);
      if (antigo) await supabase.storage.from('documentos').remove([antigo]);
    },
    addContractDoc: async (pid, d, file) => {
      let storage_path = null;
      if (file) {
        const path = pid + '/contratos/' + Date.now() + '-' + nomeSeguro(file.name);
        const { error: upErr } = await supabase.storage.from('documentos').upload(path, file);
        if (upErr) throw upErr;
        storage_path = path;
      }
      const kind = d.kind || 'termo';
      const { error } = await supabase.from('contracts').insert({
        project_id: pid,
        kind,
        name: d.name,
        storage_path,
        method: d.method || (kind === 'termo' ? 'aceite' : 'autentique'),
        body: d.body || null,
      });
      must(error);
    },
    deleteContractDoc: async (pid, cid) => {
      const { data: c } = await supabase
        .from('contracts')
        .select('storage_path')
        .eq('id', cid)
        .maybeSingle();
      if (c && c.storage_path) {
        await supabase.storage.from('documentos').remove([c.storage_path]);
      }
      const { error } = await supabase.from('contracts').delete().eq('id', cid);
      must(error);
    },
    sendToAutentique: async (pid, cid) => {
      return invocar('autentique-send', { contractId: cid });
    },
    checkAutentique: async (pid, cid) => {
      const { data: fn, error } = await supabase.functions.invoke('autentique-check', {
        body: { contractId: cid },
      });
      if (error) return null; // verificação silenciosa — não incomoda o usuário
      return fn;
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
        const path = pid + '/quotes/' + Date.now() + '-' + nomeSeguro(file.name);
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
        contact: d.contact || '',
        deadline: d.deadline || '',
        payment: d.payment || '',
        contract_status: 'a_iniciar',
        notes: '',
        storage_path,
      });
      must(error);
    },
    addFornecedor: async (d) => {
      const { error } = await supabase.from('fornecedores').insert(fornecedorRow(d));
      must(error);
    },
    updateFornecedor: async (fid, d) => {
      const { error } = await supabase.from('fornecedores').update(fornecedorRow(d)).eq('id', fid);
      must(error);
    },
    deleteFornecedor: async (fid) => {
      const { error } = await supabase.from('fornecedores').delete().eq('id', fid);
      must(error);
    },
    // decisão do cliente (Etapa 8): aprovar, reprovar ou pedir negociação
    decidirOrcamento: async (qid, decisao, mensagem) => {
      const { error } = await supabase.rpc('decidir_orcamento', {
        p_orcamento: qid,
        p_decisao: decisao,
        p_mensagem: mensagem || null,
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
        .insert({
          project_id: pid,
          date: d.date,
          title: d.title,
          kind: d.kind || 'evento',
          time: d.time || null,
          link: d.link || null,
        });
      must(error);
    },
    updateProject: async (pid, d) => {
      const { error } = await supabase
        .from('projects')
        .update({
          code: d.code,
          name: d.name,
          ...camposProjeto(d),
        })
        .eq('id', pid);
      must(error);
    },
    deleteProject: async (pid) => {
      // 1) arquivos do projeto no Storage (o banco apaga as linhas em cascata,
      //    mas os arquivos físicos ficariam órfãos)
      const caminhos = [];
      const listar = async (prefixo) => {
        const { data, error } = await supabase.storage.from('documentos').list(prefixo, { limit: 1000 });
        if (error) return;
        for (const item of data || []) {
          const caminho = prefixo + '/' + item.name;
          if (item.id) caminhos.push(caminho);
          else await listar(caminho); // pasta
        }
      };
      await listar(pid);
      if (caminhos.length) {
        const { error: eArq } = await supabase.storage.from('documentos').remove(caminhos);
        if (eArq) throw eArq;
      }
      // 2) o projeto (etapas, documentos, contratos, pagamentos... vão junto)
      const { error } = await supabase.from('projects').delete().eq('id', pid);
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
