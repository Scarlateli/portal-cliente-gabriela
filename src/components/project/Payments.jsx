import { useState } from 'react';
import { AlertTriangle, Check, Clock } from 'lucide-react';
import { Empty } from '../atoms.jsx';
import { money, fmt, todayISO } from '../../lib/helpers.js';

export function Payments({ db, project, isStudio }) {
  const pay = db.payment(project.id);
  const [f, setF] = useState({ total: '', n: '3', first: todayISO(), interval: '1' });
  const status = (i) => (i.status !== 'pago' && i.due < todayISO() ? 'atrasado' : i.status);

  if (!pay) {
    if (!isStudio) return <section className="panel"><header className="panel-head"><h2>Pagamentos</h2></header><Empty text="Nenhum plano de pagamento cadastrado ainda." /></section>;
    return (
      <section className="panel">
        <header className="panel-head"><h2>Pagamentos</h2></header>
        <p className="hint">Cadastre o plano de pagamento do projeto. As parcelas aparecem para você e para o cliente.</p>
        <div className="form-grid">
          <label className="lab">Valor total (R$)<input type="number" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} placeholder="24000" /></label>
          <label className="lab">Nº de parcelas<input type="number" value={f.n} onChange={(e) => setF({ ...f, n: e.target.value })} /></label>
          <label className="lab">1º vencimento<input type="date" value={f.first} onChange={(e) => setF({ ...f, first: e.target.value })} /></label>
          <label className="lab">Intervalo (meses)<input type="number" value={f.interval} onChange={(e) => setF({ ...f, interval: e.target.value })} /></label>
        </div>
        <div className="row"><button className="btn btn-primary" disabled={!f.total || !f.n} onClick={() => db.createPlan(project.id, Number(f.total), Number(f.n), f.first, Number(f.interval))}>Gerar parcelas</button></div>
      </section>
    );
  }

  const paid = pay.installments.filter((i) => i.status === 'pago').reduce((s, i) => s + i.amount, 0);
  const remaining = pay.total - paid;
  const left = pay.installments.filter((i) => i.status !== 'pago').length;
  const next = pay.installments.find((i) => i.status !== 'pago');
  const overdue = pay.installments.filter((i) => status(i) === 'atrasado');

  return (
    <section className="panel">
      <header className="panel-head"><h2>Pagamentos</h2></header>
      <div className="pay-summary">
        <div className="pay-kpi"><small>Pago</small><strong>{money(paid)}</strong></div>
        <div className="pay-kpi"><small>Em aberto</small><strong>{money(remaining)}</strong></div>
        <div className="pay-kpi"><small>Parcelas restantes</small><strong>{left} de {pay.installments.length}</strong></div>
        <div className="pay-kpi"><small>Próximo vencimento</small><strong>{next ? fmt(next.due) : '—'}</strong></div>
      </div>
      <div className="pay-bar"><span style={{ width: Math.round((paid / pay.total) * 100) + '%' }} /></div>

      {overdue.length > 0 && (
        <div className="alert">
          <AlertTriangle size={16} />
          <span>{overdue.length === 1 ? 'Parcela ' + overdue[0].n + ' venceu em ' + fmt(overdue[0].due) + '.' : overdue.length + ' parcelas em atraso.'} {!isStudio && 'Um lembrete automático é enviado ao seu e-mail.'}</span>
        </div>
      )}

      <ul className="inst-list">
        {pay.installments.map((i) => {
          const st = status(i);
          return (
            <li key={i.n} className="inst">
              <span className="inst-n">{i.n}</span>
              <span className="inst-meta"><strong>{money(i.amount)}</strong><small>Vencimento {fmt(i.due)}{i.paidAt ? ' · pago em ' + fmt(i.paidAt) : ''}</small></span>
              <span className={'pill ' + (st === 'pago' ? 'pill-done' : st === 'atrasado' ? 'pill-late' : 'pill-next')}>
                {st === 'pago' ? <Check size={12} /> : st === 'atrasado' ? <AlertTriangle size={12} /> : <Clock size={12} />}
                {st === 'pago' ? 'Pago' : st === 'atrasado' ? 'Atrasado' : 'Pendente'}
              </span>
              {isStudio && i.status !== 'pago' && <button className="btn btn-ghost btn-sm" onClick={() => db.markPaid(project.id, i.n)}>Marcar pago</button>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
