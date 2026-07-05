import { useState } from 'react';
import {
  FolderKanban,
  FilePlus2,
  LayoutTemplate,
  Bell,
  Hash,
  User,
  MapPin,
  ChevronRight,
  Plus,
  X,
  AlertTriangle,
  ThumbsDown,
  CircleCheck,
} from 'lucide-react';
import { TopBar, Empty, Loading, ErrorBox, ErrorBanner } from '../atoms.jsx';
import { stageOverdue, fmt, todayISO } from '../../lib/helpers.js';
import { STAGE_CATEGORIES } from '../../lib/constants.js';
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
    ]),
  );

  if (!r.ready) {
    return (
      <div className="shell">
        <TopBar user={user} onLogout={onLogout} />
        <main className="content">{r.error ? <ErrorBox /> : <Loading />}</main>
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
  const [tab, setTab] = useState('projetos');
  const projects = db.projects();
  const notes = db.notifications();
  const alerts = notes.filter((n) => n.kind === 'atraso').length;
  return (
    <div className="shell">
      <TopBar user={user} onLogout={onLogout} />
      <main className="content">
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
            <FilePlus2 size={15} /> Novo projeto
          </button>
          <button
            className={'tab' + (tab === 'templates' ? ' active' : '')}
            onClick={() => setTab('templates')}
          >
            <LayoutTemplate size={15} /> Templates
          </button>
          <button
            className={'tab' + (tab === 'notif' ? ' active' : '')}
            onClick={() => setTab('notif')}
          >
            <Bell size={15} /> Notificações{' '}
            {alerts > 0 && <span className="tab-badge">{alerts}</span>}
          </button>
        </nav>
        {tab === 'projetos' &&
          (projects.length === 0 ? (
            <Empty text="Nenhum projeto por aqui ainda — comece pela aba “Novo projeto”." />
          ) : (
            <div className="proj-grid">
              {projects.map((p) => (
                <AdminProjectCard key={p.id} baseDb={baseDb} p={p} onOpen={onOpen} />
              ))}
            </div>
          ))}
        {tab === 'novo' && <NewProject db={db} onDone={() => setTab('projetos')} />}
        {tab === 'templates' && <Templates db={db} />}
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
        <User size={12} /> {clientName}
      </p>
      <p className="proj-addr">
        <MapPin size={12} /> {p.address}
      </p>
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
    address: '',
    start: todayISO(),
    due: '',
    clientName: '',
    clientEmail: '',
    pass: 'mudar123',
  });
  const [errors, setErrors] = useState({});
  const [invite, setInvite] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const create = async () => {
    const res = validate(newProjectSchema, f);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors({});
    try {
      const created = await db.addProject(f);
      if (created && created.tempPassword)
        setInvite({
          password: created.tempPassword,
          sent: !!created.inviteEmailSent,
          email: f.clientEmail.trim().toLowerCase(),
        });
      else onDone();
    } catch {
      /* erro exibido pelo ErrorBanner do contêiner */
    }
  };
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Cadastrar novo projeto</h2>
      </header>
      <div className="form-grid">
        <h4 className="form-sec">Dados do projeto</h4>
        <label className="lab">
          Código do projeto
          <input value={f.code} onChange={set('code')} placeholder="ex.: FRV-003" />
          {errors.code && <span className="error">{errors.code}</span>}
        </label>
        <label className="lab">
          Nome do projeto
          <input value={f.name} onChange={set('name')} placeholder="ex.: Residência Oliveira" />
          {errors.name && <span className="error">{errors.name}</span>}
        </label>
        <label className="lab full">
          Endereço
          <input
            value={f.address}
            onChange={set('address')}
            placeholder="Rua, número — bairro, cidade"
          />
        </label>
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
          <input value={f.clientName} onChange={set('clientName')} placeholder="Nome completo" />
          {errors.clientName && <span className="error">{errors.clientName}</span>}
        </label>
        <label className="lab">
          E-mail de acesso
          <input
            type="email"
            value={f.clientEmail}
            onChange={set('clientEmail')}
            placeholder="email@cliente.com"
          />
          {errors.clientEmail && <span className="error">{errors.clientEmail}</span>}
        </label>
        {!IS_SUPABASE && (
          <label className="lab">
            Senha inicial
            <input value={f.pass} onChange={set('pass')} />
            {errors.pass && <span className="error">{errors.pass}</span>}
          </label>
        )}
      </div>
      <p className="hint">
        {IS_SUPABASE
          ? 'Ao criar o projeto, uma senha provisória é gerada para o cliente — copie e envie por WhatsApp (ou deixe ir por e-mail, com o Resend ativo). No primeiro acesso, ele cria a senha definitiva.'
          : 'A senha inicial será usada pelo cliente no primeiro acesso (modo demonstração).'}
      </p>
      <div className="row">
        <button className="btn btn-primary" onClick={create} disabled={!!invite}>
          Criar projeto
        </button>
      </div>
      {invite && (
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
                  'Portal do Cliente — ' +
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
  const [name, setName] = useState('');
  const [items, setItems] = useState([{ title: '', category: 'Reunião', desc: '' }]);
  const upd = (i, k, v) => setItems(items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const save = async () => {
    const clean = items.filter((i) => i.title.trim());
    if (name.trim() && clean.length) {
      try {
        await db.addTemplate(name.trim(), clean);
        setName('');
        setItems([{ title: '', category: 'Reunião', desc: '' }]);
      } catch {
        /* erro exibido pelo ErrorBanner do contêiner */
      }
    }
  };
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Templates de etapas</h2>
      </header>
      <div className="tpl-list">
        {templates.map((t) => (
          <div key={t.id} className="tpl-card">
            <strong>{t.name}</strong>
            <ol className="tpl-items">
              {t.items.map((it, i) => (
                <li key={i}>
                  {it.title} <em>· {it.category}</em>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <h4 className="form-sec">Novo template</h4>
      <input
        className="tpl-name"
        placeholder="Nome do template"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {items.map((it, i) => (
        <div key={i} className="tpl-row">
          <input
            placeholder={'Etapa ' + (i + 1)}
            value={it.title}
            onChange={(e) => upd(i, 'title', e.target.value)}
          />
          <select value={it.category} onChange={(e) => upd(i, 'category', e.target.value)}>
            {STAGE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button
            className="icon-btn"
            onClick={() => setItems(items.filter((_, idx) => idx !== i))}
            disabled={items.length === 1}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <div className="row">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setItems([...items, { title: '', category: 'Reunião', desc: '' }])}
        >
          <Plus size={14} /> Adicionar etapa
        </button>
        <button className="btn btn-primary btn-sm" onClick={save}>
          Salvar template
        </button>
      </div>
    </section>
  );
}
