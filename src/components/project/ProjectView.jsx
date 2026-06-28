import { useState } from 'react';
import {
  GitCommitVertical, CalendarDays, FileText, PenLine, Wallet, ClipboardList, Handshake,
  Building2, Hash, User, Clock, CircleCheck, ArrowLeft, Printer,
} from 'lucide-react';
import { TopBar } from '../atoms.jsx';
import { fmt, todayISO } from '../../lib/helpers.js';
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
  { id: 'contract', label: 'Contrato', I: PenLine },
  { id: 'payments', label: 'Pagamentos', I: Wallet },
  { id: 'quotes', label: 'Orçamentos', I: ClipboardList },
  { id: 'suppliers', label: 'Fornecedores', I: Handshake },
];

export function ProjectView({ db, user, project, isStudio, onLogout, onBack, onPrint }) {
  const [tab, setTab] = useState('timeline');
  const expired = project.accessUntil && todayISO() > project.accessUntil;

  return (
    <div className="shell">
      <TopBar user={user} onLogout={onLogout}
        left={isStudio ? <button className="icon-btn" title="Voltar" onClick={onBack}><ArrowLeft size={16} /></button> : null}
        right={<button className="btn btn-ghost btn-sm" onClick={() => onPrint(project.id)}><Printer size={14} /> Histórico PDF</button>}
      />
      <main className="content">
        <div className="hero">
          <div className="hero-headrow">
            <span className="hero-tag">{project.status === 'concluido' ? 'Concluído' : 'Em andamento'}</span>
            <span className="hero-code"><Hash size={11} /> {project.code}</span>
          </div>
          <h1 className="hero-name">{project.name}</h1>
          <div className="hero-rows">
            <span><Building2 size={14} /> {project.address}</span>
            <span><CalendarDays size={14} /> Início {fmt(project.start)} · Entrega prevista {fmt(project.due)}</span>
            {isStudio && <span><User size={14} /> {db.clientName(project.id)}</span>}
          </div>
        </div>

        {project.accessUntil && (
          <div className={'access ' + (expired ? 'access-off' : '')}>
            <Clock size={14} />
            {expired ? <span>O acesso do cliente a este projeto expirou em {fmt(project.accessUntil)}. Ele ainda pode gerar o histórico em PDF.</span>
              : <span>Projeto finalizado. O acesso do cliente encerra em {fmt(project.accessUntil)} — baixe o histórico antes disso.</span>}
          </div>
        )}

        <nav className="tabs" role="tablist">
          {TABS.map(({ id, label, I }) => (
            <button key={id} role="tab" aria-selected={tab === id} className={'tab' + (tab === id ? ' active' : '')} onClick={() => setTab(id)}><I size={15} /> {label}</button>
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
          <button className="btn btn-ghost finish-btn" onClick={() => { if (window.confirm('Finalizar o projeto? O acesso do cliente passa a expirar em 1 mês.')) db.completeProject(project.id); }}>
            <CircleCheck size={15} /> Finalizar projeto
          </button>
        )}
      </main>
    </div>
  );
}
