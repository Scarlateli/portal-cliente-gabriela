import { useState } from 'react';
import {
  GitCommitVertical,
  CalendarDays,
  FileText,
  PenLine,
  Wallet,
  ClipboardList,
  Handshake,
  Building2,
  Hash,
  User,
  Clock,
  CircleCheck,
  ArrowLeft,
  Printer,
} from 'lucide-react';
import { TopBar, Loading, ErrorBox, ErrorBanner } from '../atoms.jsx';
import { fmt, todayISO } from '../../lib/helpers.js';
import { qk } from '../../lib/data.js';
import { useResolvedDb, specsFor } from '../../lib/useResolvedDb.js';
import { Timeline } from './Timeline.jsx';
import { Calendar } from './Calendar.jsx';
import { Documents } from './Documents.jsx';
import { Contract } from './Contract.jsx';
import { Payments } from './Payments.jsx';
import { Quotes } from './Quotes.jsx';
import { Suppliers } from './Suppliers.jsx';

const TABS = [
  { id: 'timeline', label: 'Linha do tempo', I: GitCommitVertical },
  { id: 'calendar', label: 'Calendário', I: CalendarDays },
  { id: 'docs', label: 'Documentos', I: FileText },
  { id: 'contract', label: 'Contratos', I: PenLine },
  { id: 'payments', label: 'Pagamentos', I: Wallet },
  { id: 'quotes', label: 'Orçamentos', I: ClipboardList },
  { id: 'suppliers', label: 'Fornecedores', I: Handshake },
];

export function ProjectView({ db: baseDb, user, pid, isStudio, onLogout, onBack, onPrint }) {
  const r = useResolvedDb(
    baseDb,
    specsFor(baseDb, [
      { key: qk.project(pid), method: 'project', args: [pid] },
      { key: qk.clientName(pid), method: 'clientName', args: [pid] },
      { key: qk.templates(), method: 'templates' },
      { key: qk.stages(pid), method: 'stages', args: [pid] },
      { key: qk.calendar(pid), method: 'calendarEvents', args: [pid] },
      { key: qk.documents(pid), method: 'documents', args: [pid] },
      { key: qk.contracts(pid), method: 'contracts', args: [pid] },
      { key: qk.payment(pid), method: 'payment', args: [pid] },
      { key: qk.quotes(pid), method: 'quotes', args: [pid] },
      { key: qk.suppliers(pid), method: 'suppliers', args: [pid] },
    ]),
    pid,
  );

  if (!r.ready) {
    return (
      <div className="shell">
        <TopBar
          user={user}
          onLogout={onLogout}
          left={
            isStudio ? (
              <button className="icon-btn" title="Voltar" onClick={onBack}>
                <ArrowLeft size={16} />
              </button>
            ) : null
          }
        />
        <main className="content">{r.error ? <ErrorBox /> : <Loading />}</main>
      </div>
    );
  }

  const db = r.db;
  const project = db.project(pid);
  if (!project) {
    return (
      <div className="shell">
        <TopBar user={user} onLogout={onLogout} />
        <main className="content">
          <ErrorBox text="Projeto não encontrado." />
        </main>
      </div>
    );
  }

  return (
    <ProjectInner
      db={db}
      user={user}
      project={project}
      isStudio={isStudio}
      onLogout={onLogout}
      onBack={onBack}
      onPrint={onPrint}
      mutationError={r.error}
      clearError={r.clearError}
    />
  );
}

function ProjectInner({
  db,
  user,
  project,
  isStudio,
  onLogout,
  onBack,
  onPrint,
  mutationError,
  clearError,
}) {
  const [tab, setTab] = useState('timeline');
  const expired = project.accessUntil && todayISO() > project.accessUntil;

  return (
    <div className="shell">
      <TopBar
        user={user}
        onLogout={onLogout}
        left={
          isStudio ? (
            <button className="icon-btn" title="Voltar" onClick={onBack}>
              <ArrowLeft size={16} />
            </button>
          ) : null
        }
        right={
          <button className="btn btn-ghost btn-sm" onClick={() => onPrint(project.id)}>
            <Printer size={14} /> Histórico PDF
          </button>
        }
      />
      <main className="content">
        <div className="hero">
          <div className="hero-headrow">
            <span className="hero-tag">
              {project.status === 'concluido' ? 'Concluído' : 'Em andamento'}
            </span>
            <span className="hero-code">
              <Hash size={11} /> {project.code}
            </span>
          </div>
          <h1 className="hero-name">{project.name}</h1>
          <div className="hero-rows">
            <span>
              <Building2 size={14} /> {project.address}
            </span>
            <span>
              <CalendarDays size={14} /> Início {fmt(project.start)} · Entrega prevista{' '}
              {fmt(project.due)}
            </span>
            {isStudio && (
              <span>
                <User size={14} /> {db.clientName(project.id)}
              </span>
            )}
          </div>
        </div>

        {project.accessUntil && (
          <div className={'access ' + (expired ? 'access-off' : '')}>
            <Clock size={14} />
            {expired ? (
              <span>
                O acesso do cliente a este projeto expirou em {fmt(project.accessUntil)}. Ele ainda
                pode gerar o histórico em PDF.
              </span>
            ) : (
              <span>
                Projeto finalizado. O acesso do cliente encerra em {fmt(project.accessUntil)} —
                baixe o histórico antes disso.
              </span>
            )}
          </div>
        )}

        <ErrorBanner error={mutationError} onClose={clearError} />

        <nav className="tabs" role="tablist">
          {TABS.map(({ id, label, I }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={'tab' + (tab === id ? ' active' : '')}
              onClick={() => setTab(id)}
            >
              <I size={15} /> {label}
            </button>
          ))}
        </nav>

        {tab === 'timeline' && <Timeline db={db} project={project} isStudio={isStudio} />}
        {tab === 'calendar' && <Calendar db={db} project={project} isStudio={isStudio} />}
        {tab === 'docs' && <Documents db={db} project={project} isStudio={isStudio} />}
        {tab === 'contract' && <Contract db={db} project={project} isStudio={isStudio} />}
        {tab === 'payments' && <Payments db={db} project={project} isStudio={isStudio} />}
        {tab === 'quotes' && <Quotes db={db} project={project} isStudio={isStudio} />}
        {tab === 'suppliers' && <Suppliers db={db} project={project} isStudio={isStudio} />}

        {isStudio && project.status !== 'concluido' && (
          <button
            className="btn btn-ghost finish-btn"
            onClick={() => {
              if (
                window.confirm('Finalizar o projeto? O acesso do cliente passa a expirar em 1 mês.')
              )
                db.completeProject(project.id);
            }}
          >
            <CircleCheck size={15} /> Finalizar projeto
          </button>
        )}
      </main>
    </div>
  );
}
