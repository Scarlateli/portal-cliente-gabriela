import { useState } from 'react';
import { Handshake, CircleCheck, PenLine } from 'lucide-react';
import { Empty } from '../atoms.jsx';
import { SEGMENTS, CONTRACT_STATUS } from '../../lib/constants.js';
import { money, fmt } from '../../lib/helpers.js';

export function Suppliers({ db, project, isStudio }) {
  const approved = db.suppliers(project.id);
  const [seg, setSeg] = useState('');
  const segsPresent = SEGMENTS.filter((s) => approved.some((q) => q.segment === s));
  const shownList = seg ? approved.filter((q) => q.segment === seg) : approved;
  const grouped = SEGMENTS.map((s) => ({ seg: s, items: shownList.filter((q) => q.segment === s) })).filter((g) => g.items.length);
  const total = shownList.reduce((s, q) => s + q.amount, 0);
  return (
    <section className="panel">
      <header className="panel-head"><h2>Fornecedores contratados</h2></header>
      {approved.length === 0 ? <Empty text="Nenhum fornecedor contratado ainda. Orçamentos aprovados aparecem aqui." /> : (
        <>
          <div className="sup-total"><Handshake size={16} /> {shownList.length} contratados · {money(total)}</div>
          {segsPresent.length > 1 && (
            <div className="filter-row">
              {segsPresent.map((sg) => (
                <button key={sg} className={'filter' + (seg === sg ? ' on' : '')} onClick={() => setSeg(seg === sg ? '' : sg)}>{sg}</button>
              ))}
            </div>
          )}
          {grouped.map((g) => (
            <div key={g.seg} className="seg-block">
              <h4 className="seg-title">{g.seg}</h4>
              {g.items.map((q) => <SupplierCard key={q.id} db={db} q={q} isStudio={isStudio} />)}
            </div>
          ))}
        </>
      )}
    </section>
  );
}

function SupplierCard({ db, q, isStudio }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState(q);
  const cs = CONTRACT_STATUS.find((c) => c.id === (q.contractStatus || 'a_iniciar')) || CONTRACT_STATUS[0];
  const save = () => { db.updateQuote(q.id, { contact: f.contact, deadline: f.deadline, payment: f.payment, contractStatus: f.contractStatus, notes: f.notes }); setEditing(false); };
  return (
    <div className="sup-card">
      <div className="sup-card-top">
        <span className="sup-ic"><CircleCheck size={18} /></span>
        <span className="sup-main"><strong>{q.supplier}</strong><small>Aprovado em {fmt(q.decidedAt)} · {q.fileName || 'sem arquivo'}</small></span>
        <span className="quote-val">{money(q.amount)}</span>
      </div>
      <div className="sup-status">
        <span className={'pill ' + (cs.id === 'entregue' ? 'pill-done' : cs.id === 'em_producao' ? 'pill-now' : 'pill-next')}>{cs.label}</span>
        {isStudio && !editing && <button className="link sm" onClick={() => { setF({ ...q }); setEditing(true); }}><PenLine size={12} /> Editar contrato</button>}
      </div>

      {!editing ? (
        <dl className="sup-info">
          <div><dt>Contato</dt><dd>{q.contact || '—'}</dd></div>
          <div><dt>Prazo de execução</dt><dd>{q.deadline || '—'}</dd></div>
          <div><dt>Pagamento</dt><dd>{q.payment || '—'}</dd></div>
          {q.notes && <div className="full"><dt>Observações</dt><dd>{q.notes}</dd></div>}
        </dl>
      ) : (
        <div className="sup-edit">
          <div className="add-row">
            <label className="lab">Contato<input value={f.contact || ''} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder="Nome · telefone · e-mail" /></label>
            <label className="lab">Status do contrato<select value={f.contractStatus || 'a_iniciar'} onChange={(e) => setF({ ...f, contractStatus: e.target.value })}>{CONTRACT_STATUS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
          </div>
          <div className="add-row">
            <label className="lab">Prazo de execução<input value={f.deadline || ''} onChange={(e) => setF({ ...f, deadline: e.target.value })} placeholder="ex.: 45 dias" /></label>
            <label className="lab">Condições de pagamento<input value={f.payment || ''} onChange={(e) => setF({ ...f, payment: e.target.value })} placeholder="ex.: 50% entrada, 50% entrega" /></label>
          </div>
          <textarea placeholder="Observações sobre o contrato com o fornecedor" value={f.notes || ''} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          <div className="row">
            <button className="btn btn-primary btn-sm" onClick={save}>Salvar</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
