import { useState, useContext } from 'react';
import { PendenciasCtx } from '../../lib/pendenciasContexto.js';
import { rotuloDia } from '../../lib/agendaStudio.js';
import { EtapasEditor } from './EtapasEditor.jsx';
import { Fornecedores } from './Fornecedores.jsx';
import { etapaVazia, copiarItens, rotuloTipoSub, ROTULO_RESP } from '../../lib/etapas.js';
import { CamposEndereco } from '../project/CamposEndereco.jsx';
import { enderecoCurto, ENDERECO_VAZIO } from '../../lib/endereco.js';
import {
  FolderKanban,
  FilePlus2,
  LayoutTemplate,
  Bell,
  Hash,
  User,
  MapPin,
  ChevronRight,
  AlertTriangle,
  ThumbsDown,
  CircleCheck,
  Trash2,
  Pencil,
  Handshake,
  Plus,
  Sun,
  Video,
} from 'lucide-react';
import { TopBar, Empty, Esqueleto, ErrorBox, ErrorBanner } from '../atoms.jsx';
import { stageOverdue, fmt, todayISO } from '../../lib/helpers.js';

import { newProjectSchema, validate } from '../../lib/validation.js';
import { qk, IS_SUPABASE } from '../../lib/data.js';
import { useResolvedDb, specsFor } from '../../lib/useResolvedDb.js';

export function AdminHome({ db: baseDb, user, onLogout, onOpen }) {
  const r = useResolvedDb(
    baseDb,
    specsFor(baseDb, [
      { key: qk.projects(), method: 'projects' },
      { key: qk.notifications(), method: 'notifications' },
      { key: qk.templates(), method: 'templates' },
      { key: qk.fornecedores(), method: 'fornecedores' },
      // tela "Hoje" (rodada 10)
      { key: qk.pendencias(), method: 'pendencias', args: ['studio', user && user.id] },
      { key: qk.agenda(), method: 'agendaStudio' },
    ]),
  );

  if (!r.ready) {
    return (
      <div className="shell">
        <TopBar user={user} onLogout={onLogout} />
        <main id="conteudo" className="content">{r.error ? <ErrorBox error={r.error} /> : <Esqueleto />}</main>
      </div>
    );
  }

  return (
    <AdminInner
      db={r.db}
      baseDb={baseDb}
      user={user}
      onLogout={onLogout}
      onOpen={onOpen}
      mutationError={r.error}
      clearError={r.clearError}
    />
  );
}

function AdminInner({ db, baseDb, user, onLogout, onOpen, mutationError, clearError }) {
  // rodada 10: o painel abre em "Hoje" (o que espera por ela e a semana)
  const [tab, setTab] = useState('hoje');
  const pend = (db.pendencias && db.pendencias('studio', user.id)) || [];
  const projects = db.projects();
  const notes = db.notifications();
  const alerts = notes.filter((n) => n.kind === 'atraso').length;
  return (
    <div className="shell">
      <TopBar user={user} onLogout={onLogout} />
      <main id="conteudo" className="content">
        <div className="hero">
          <span className="hero-tag">Painel do studio</span>
          <h1 className="hero-name">Olá, {user.name}</h1>
          <div className="hero-rows">
            <span>
              <FolderKanban size={14} /> {projects.length} projetos ativos no portal
            </span>
          </div>
        </div>
        <ErrorBanner error={mutationError} onClose={clearError} />
        <nav className="tabs" role="tablist">
          <button className={'tab' + (tab === 'hoje' ? ' active' : '')} onClick={() => setTab('hoje')}>
            <Sun size={15} /> Hoje {pend.length > 0 && <span className="tab-badge">{pend.length}</span>}
          </button>
          <button
            className={'tab' + (tab === 'projetos' ? ' active' : '')}
            onClick={() => setTab('projetos')}
          >
            <FolderKanban size={15} /> Projetos
          </button>
          <button
            className={'tab' + (tab === 'novo' ? ' active' : '')}
            onClick={() => setTab('novo')}
          >
            <FilePlus2 size={15} /> Novo Projeto
          </button>
          <button
            className={'tab' + (tab === 'templates' ? ' active' : '')}
            onClick={() => setTab('templates')}
          >
            <LayoutTemplate size={15} /> Templates
          </button>
          <button
            className={'tab' + (tab === 'fornecedores' ? ' active' : '')}
            onClick={() => setTab('fornecedores')}
          >
            <Handshake size={15} /> Fornecedores
          </button>
          <button
            className={'tab' + (tab === 'notif' ? ' active' : '')}
            onClick={() => setTab('notif')}
          >
            <Bell size={15} /> Notificações{' '}
            {alerts > 0 && <span className="tab-badge">{alerts}</span>}
          </button>
        </nav>
        {tab === 'hoje' && <Hoje db={db} pend={pend} onOpen={onOpen} />}
        {tab === 'projetos' &&
          (projects.length === 0 ? (
            <Empty text="Nenhum projeto por aqui ainda. Comece pela aba “Novo Projeto”: em poucos minutos o cliente recebe o acesso." />
          ) : (
            <div className="proj-grid">
              {projects.map((p) => (
                <AdminProjectCard key={p.id} baseDb={baseDb} p={p} onOpen={onOpen} />
              ))}
            </div>
          ))}
        {tab === 'novo' && <NewProject db={db} onDone={() => setTab('projetos')} />}
        {tab === 'templates' && <Templates db={db} />}
        {tab === 'fornecedores' && <Fornecedores db={db} />}
        {tab === 'notif' && <Notifications notes={notes} onOpen={onOpen} />}
      </main>
    </div>
  );
}

// Card de projeto: resolve as próprias etapas + nome do cliente (funciona
// em mock — síncrono — e supabase — via React Query).
function AdminProjectCard({ baseDb, p, onOpen }) {
  const r = useResolvedDb(
    baseDb,
    specsFor(baseDb, [
      { key: qk.stages(p.id), method: 'stages', args: [p.id] },
      { key: qk.clientName(p.id), method: 'clientName', args: [p.id] },
    ]),
    p.id,
  );
  const stages = r.ready ? r.db.stages(p.id) || [] : [];
  const clientName = r.ready ? r.db.clientName(p.id) || '—' : '…';
  const done = stages.filter((s) => s.status === 'concluida').length;
  const late = stages.filter((s) => stageOverdue(s)).length;
  return (
    <button className="proj-card" onClick={() => onOpen(p.id)}>
      <div className="proj-top">
        <span className="proj-code">
          <Hash size={11} /> {p.code}
        </span>
        <span className={'dot-status ' + (p.status === 'concluido' ? 'ds-done' : 'ds-active')}>
          {p.status === 'concluido' ? 'Concluído' : 'Em andamento'}
        </span>
      </div>
      <h3>{p.name}</h3>
      <p className="proj-client">
        <User size={12} /> Cliente: {clientName}
      </p>
      {enderecoCurto(p) && (
        <p className="proj-addr">
          <MapPin size={12} /> {enderecoCurto(p)}
        </p>
      )}
      <div className="proj-foot">
        <span>
          {stages.length ? done + '/' + stages.length + ' etapas' : 'Sem etapas'}
          {late > 0 && <span className="late-flag"> · {late} em atraso</span>}
        </span>
        <span className="open">
          Abrir portal <ChevronRight size={14} />
        </span>
      </div>
    </button>
  );
}

function Notifications({ notes, onOpen }) {
  const icon = (k) =>
    k === 'atraso' ? (
      <AlertTriangle size={16} />
    ) : k === 'reprovado' ? (
      <ThumbsDown size={16} />
    ) : (
      <CircleCheck size={16} />
    );
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Notificações</h2>
      </header>
      {notes.length === 0 ? (
        <Empty text="Nenhuma notificação no momento." />
      ) : (
        <ul className="notif-list">
          {notes.map((n) => (
            <li key={n.id} className={'notif notif-' + n.kind}>
              <span className="notif-ic">{icon(n.kind)}</span>
              <div className="notif-body">
                <strong>{n.title}</strong>
                <p>{n.body}</p>
                <small>
                  {n.projectName} · {fmt(n.date)}
                </small>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => onOpen(n.projectId)}>
                Abrir projeto
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">
        No backend, as notificações de atraso disparam o e-mail automático ao cliente e podem virar
        push/WhatsApp.
      </p>
    </section>
  );
}

function NewProject({ db, onDone }) {
  const [f, setF] = useState({
    code: '',
    name: '',
    ...ENDERECO_VAZIO,
    greeting: '',
    start: todayISO(),
    due: '',
    clientName: '',
    clientEmail: '',
    pass: 'mudar123',
  });
  const [errors, setErrors] = useState({});
  const [invite, setInvite] = useState(null);
  const [saving, setSaving] = useState(false);
  const templates = db.templates();
  const [tplId, setTplId] = useState('');
  const [etapas, setEtapas] = useState([]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const escolherTemplate = (id) => {
    setTplId(id);
    const t = templates.find((x) => x.id === id);
    setEtapas(t ? copiarItens(t.items) : []);
  };
  const create = async () => {
    const res = validate(newProjectSchema, f);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    if (saving) return; // proteção contra duplo clique (projeto/e-mail duplicados)
    setErrors({});
    setSaving(true);
    try {
      const created = await db.addProject({ ...f, etapas: etapas.filter((e) => e.title.trim()) });
      if (created && created.tempPassword)
        setInvite({
          password: created.tempPassword,
          sent: !!created.inviteEmailSent,
          email: f.clientEmail.trim().toLowerCase(),
        });
      else if (created && created.jaTinhaAcesso)
        setInvite({ existente: true, email: f.clientEmail.trim().toLowerCase() });
      else onDone();
    } catch {
      /* erro exibido pelo ErrorBanner do contêiner */
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Cadastrar Novo Projeto</h2>
      </header>
      <div className="form-grid">
        <h4 className="form-sec">Dados do projeto</h4>
        <label className="lab">
          Código do projeto
          <input value={f.code} onChange={set('code')} placeholder="Código do projeto" aria-label="Código do projeto" />
          {errors.code && <span className="error">{errors.code}</span>}
        </label>
        <label className="lab">
          Nome do projeto
          <input value={f.name} onChange={set('name')} placeholder="Nome do projeto" aria-label="Nome do projeto" />
          {errors.name && <span className="error">{errors.name}</span>}
        </label>
        <h4 className="form-sec">Endereço da obra</h4>
        <CamposEndereco f={f} setF={setF} />
        <h4 className="form-sec">Prazos</h4>
        <label className="lab">
          Início
          <input type="date" value={f.start} onChange={set('start')} />
        </label>
        <label className="lab">
          Entrega prevista
          <input type="date" value={f.due} onChange={set('due')} />
        </label>
        <h4 className="form-sec">Dados do cliente</h4>
        <label className="lab">
          Nome do cliente
          <input value={f.clientName} onChange={set('clientName')} placeholder="Nome do cliente" aria-label="Nome do cliente" />
          {errors.clientName && <span className="error">{errors.clientName}</span>}
        </label>
        <label className="lab">
          E-mail de acesso
          <input
            type="email"
            value={f.clientEmail}
            onChange={set('clientEmail')}
            placeholder="email@cliente.com" aria-label="E-mail de acesso do cliente"
          />
          {errors.clientEmail && <span className="error">{errors.clientEmail}</span>}
        </label>
        <label className="lab full">
          Como o portal cumprimenta (opcional)
          <input
            value={f.greeting}
            onChange={set('greeting')}
            placeholder="ex.: Família Silva"
            aria-label="Como o portal cumprimenta o cliente"
            maxLength={60}
          />
          <span className="hint lab-hint">
            Aparece no “Olá, …” do portal. O contrato continua no nome do cliente. Em branco, usa o primeiro nome dele.
          </span>
        </label>
        {!IS_SUPABASE && (
          <label className="lab">
            Senha inicial
            <input value={f.pass} onChange={set('pass')} />
            {errors.pass && <span className="error">{errors.pass}</span>}
          </label>
        )}
      </div>
      <h4 className="form-sec form-sec-bloco">Etapas do projeto</h4>
      <label className="lab">
        Começar a partir de um template
        <select value={tplId} onChange={(e) => escolherTemplate(e.target.value)}>
          <option value="">Nenhum (montar do zero)</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <p className="hint">
        Ajuste as etapas e sub-etapas antes de criar o projeto: as mudanças valem só para este projeto e o template
        continua igual. Depois de criado, tudo segue editável na linha do tempo.
      </p>
      <EtapasEditor itens={etapas} onChange={setEtapas} />
      <p className="hint">
        {IS_SUPABASE
          ? 'Ao criar o projeto, uma senha provisória é gerada para o cliente — copie e envie por WhatsApp (ou deixe ir por e-mail, com o Resend ativo). No primeiro acesso, ele cria a senha definitiva.'
          : 'A senha inicial será usada pelo cliente no primeiro acesso (modo demonstração).'}
      </p>
      <div className="row">
        <button className="btn btn-primary" onClick={create} disabled={!!invite || saving}>
          {saving ? 'Criando…' : 'Criar projeto'}
        </button>
      </div>
      {invite && invite.existente && (
        <div className="invite-box">
          <strong>Projeto criado! Esse cliente já tinha acesso ao portal.</strong>
          <p className="hint">
            O projeto novo já aparece para {invite.email}, com a senha que ele usa hoje. Nada mudou no acesso dele.
          </p>
          <div className="row">
            <button className="btn btn-primary btn-sm" onClick={onDone}>
              Concluir
            </button>
          </div>
        </div>
      )}
      {invite && !invite.existente && (
        <div className="invite-box">
          <strong>
            {invite.sent
              ? 'Projeto criado! Convite com a senha provisória enviado para ' + invite.email
              : 'Projeto criado! Acesso provisório do cliente'}
          </strong>
          <code>
            e-mail: {invite.email}
            <br />
            senha provisória: {invite.password}
          </code>
          <div className="row">
            <button
              className="btn btn-primary btn-sm"
              onClick={() =>
                navigator.clipboard &&
                navigator.clipboard.writeText(
                  'Portal do Projeto — ' +
                    window.location.origin +
                    '\nE-mail: ' +
                    invite.email +
                    '\nSenha provisória: ' +
                    invite.password,
                )
              }
            >
              Copiar dados de acesso
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onDone}>
              Concluir
            </button>
          </div>
          <p className="hint">
            {invite.sent
              ? 'Se preferir, copie e mande também por WhatsApp — no primeiro acesso o cliente cria a senha definitiva.'
              : 'Copie e envie ao cliente por WhatsApp ou e-mail. No primeiro acesso, ele será levado a criar a senha definitiva.'}
          </p>
        </div>
      )}
    </section>
  );
}

function Templates({ db }) {
  const templates = db.templates();
  const [aberto, setAberto] = useState(null); // template expandido (só leitura)
  const [editando, setEditando] = useState(null); // 'novo' | id do template | null
  const [name, setName] = useState('');
  const [items, setItems] = useState([etapaVazia()]);
  const [salvando, setSalvando] = useState(false);
  const formNovoAberto = editando === 'novo' || (templates.length === 0 && editando === null);

  const limpar = () => {
    setEditando(null);
    setName('');
    setItems([etapaVazia()]);
  };
  const editar = (t) => {
    setEditando(t.id);
    setAberto(null);
    setName(t.name);
    setItems(copiarItens(t.items).length ? copiarItens(t.items) : [etapaVazia()]);
  };
  const novo = () => {
    setEditando('novo');
    setAberto(null);
    setName('');
    setItems([etapaVazia()]);
  };
  const save = async () => {
    const clean = items.filter((i) => i.title.trim());
    if (!name.trim() || !clean.length || salvando) return;
    setSalvando(true);
    try {
      if (editando && editando !== 'novo') await db.updateTemplate(editando, name.trim(), clean);
      else await db.addTemplate(name.trim(), clean);
      limpar();
    } catch {
      /* erro exibido pelo ErrorBanner do contêiner */
    } finally {
      setSalvando(false);
    }
  };
  const formulario = (titulo) => (
    <div className="tpl-form">
      <h4 className="form-sec">{titulo}</h4>
      <input
        className="tpl-name"
        placeholder="Nome do template"
        aria-label="Nome do template"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <EtapasEditor itens={items} onChange={setItems} />
      <div className="row">
        <button className="btn btn-primary btn-sm" onClick={save} disabled={salvando}>
          {salvando ? 'Salvando…' : editando && editando !== 'novo' ? 'Salvar alterações' : 'Salvar template'}
        </button>
        {(editando || templates.length > 0) && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={limpar}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Templates de Etapas</h2>
        {templates.length > 0 && !formNovoAberto && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={novo}>
            <Plus size={14} /> Novo template
          </button>
        )}
      </header>
      <div className="tpl-list">
        {templates.map((t) => {
          const nSubs = t.items.reduce((n, it) => n + (it.subs || []).length, 0);
          const exp = aberto === t.id;
          if (editando === t.id)
            return (
              <div key={t.id} className="tpl-card tpl-card-ativo">
                {formulario('Editando "' + t.name + '"')}
              </div>
            );
          return (
            <div key={t.id} className={'tpl-card' + (exp ? ' tpl-card-aberto' : '')}>
              <div className="tpl-head">
                <button
                  type="button"
                  className="tpl-toggle"
                  aria-expanded={exp}
                  onClick={() => setAberto(exp ? null : t.id)}
                >
                  <ChevronRight size={15} className="tpl-seta" />
                  <strong>{t.name}</strong>
                  <span className="tpl-resumo">
                    {t.items.length} {t.items.length === 1 ? 'etapa' : 'etapas'}
                    {nSubs ? ' · ' + nSubs + (nSubs === 1 ? ' sub-etapa' : ' sub-etapas') : ''}
                  </span>
                </button>
                <span className="tpl-acoes">
                  <button type="button" className="link sm" onClick={() => editar(t)}>
                    <Pencil size={12} /> Editar
                  </button>
                  <button
                    type="button"
                    className="link sm danger"
                    onClick={() => {
                      if (window.confirm('Excluir o template "' + t.name + '"?')) db.deleteTemplate(t.id);
                    }}
                  >
                    <Trash2 size={12} /> Excluir
                  </button>
                </span>
              </div>
              {exp && (
                <ol className="tpl-items">
                  {t.items.map((it, i) => (
                    <li key={i}>
                      {it.title} <em>· {it.category}</em>
                      {(it.subs || []).length > 0 && (
                        <ul className="tpl-subs">
                          {it.subs.map((b, k) => (
                            <li key={k}>
                              {b.title} <em>· {rotuloTipoSub(b)} · {ROTULO_RESP[b.responsible] || 'Studio'}</em>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
      {formNovoAberto && formulario('Novo template')}
    </section>
  );
}

/* Hoje (rodada 10): tudo o que espera pela Gabriela, de todos os projetos,
   e a agenda dos próximos 7 dias, num lugar só. */
function Hoje({ db, pend, onOpen }) {
  const ctx = useContext(PendenciasCtx);
  const ir = (pid, aba, alvo) => (ctx ? ctx.irPara(pid, aba, alvo) : onOpen(pid));
  const agenda = (db.agendaStudio && db.agendaStudio()) || { atrasados: [], proximos: [] };
  const hoje = todayISO();
  const grupos = [];
  for (const p of pend) {
    let g = grupos.find((x) => x.pid === p.pid);
    if (!g) grupos.push((g = { pid: p.pid, projeto: p.projeto, itens: [] }));
    g.itens.push(p);
  }
  const dias = [];
  for (const it of agenda.proximos) {
    let d = dias.find((x) => x.data === it.data);
    if (!d) dias.push((d = { data: it.data, itens: [] }));
    d.itens.push(it);
  }
  const dataLonga = (() => {
    const t = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
    return t.charAt(0).toUpperCase() + t.slice(1);
  })();
  const Linha = ({ it, atrasado }) => (
    <li className="hoje-item">
      <span className={'hoje-quando' + (atrasado ? ' hoje-atrasado' : '')}>
        {atrasado ? 'Venceu ' + fmt(it.data).slice(0, 5) : it.hora || '—'}
      </span>
      <button type="button" className="hoje-alvo" onClick={() => ir(it.pid, it.aba, it.alvo || null)}>
        <strong>{it.titulo}</strong>
        <span>
          {it.projeto} · {it.tipo}
          {it.quem ? ' – ' + it.quem : ''}
        </span>
      </button>
      {it.link && !atrasado && (
        <a className="btn-mini" href={it.link} target="_blank" rel="noreferrer">
          <Video size={12} /> Entrar
        </a>
      )}
    </li>
  );
  return (
    <section className="panel hoje">
      <header className="panel-head">
        <h2>Hoje</h2>
        <span className="hoje-data">{dataLonga}</span>
      </header>
      <div className="hoje-grade">
        <div className="hoje-col">
          <h3>
            Esperando você <span className="hoje-n">{pend.length}</span>
          </h3>
          {pend.length === 0 ? (
            <p className="hoje-vazio">
              <CircleCheck size={16} /> Nada esperando por você. Tudo em dia.
            </p>
          ) : (
            grupos.map((g) => (
              <div key={g.pid} className="hoje-grupo">
                <h4>{g.projeto}</h4>
                <ul>
                  {g.itens.map((p) => (
                    <li key={p.id}>
                      <button type="button" className="hoje-pend" onClick={() => ir(p.pid, p.aba, p.alvo)}>
                        <span>{p.texto}</span> <ChevronRight size={14} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
        <div className="hoje-col">
          {agenda.atrasados.length > 0 && (
            <>
              <h3>
                Atrasados <span className="hoje-n hoje-n-atraso">{agenda.atrasados.length}</span>
              </h3>
              <ul className="hoje-lista">
                {agenda.atrasados.map((it) => (
                  <Linha key={it.id} it={it} atrasado />
                ))}
              </ul>
            </>
          )}
          <h3>Próximos 7 dias</h3>
          {dias.length === 0 ? (
            <p className="hoje-vazio">Nenhuma reunião, visita ou prazo nos próximos 7 dias.</p>
          ) : (
            dias.map((d) => (
              <div key={d.data} className="hoje-dia">
                <h4>{rotuloDia(d.data, hoje)}</h4>
                <ul className="hoje-lista">
                  {d.itens.map((it) => (
                    <Linha key={it.id} it={it} />
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
