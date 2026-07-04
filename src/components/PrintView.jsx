import { useEffect } from 'react';
import { Printer, ArrowLeft } from 'lucide-react';
import { Loading, ErrorBox } from './atoms.jsx';
import { DOC_TYPES, STAGE_STATUS, STUDIO } from '../lib/constants.js';
import { fmt, todayISO, money } from '../lib/helpers.js';
import { qk } from '../lib/data.js';
import { useResolvedDb, specsFor } from '../lib/useResolvedDb.js';

export function PrintView({ db: baseDb, pid, onClose }) {
  const r = useResolvedDb(
    baseDb,
    specsFor(baseDb, [
      { key: qk.project(pid), method: 'project', args: [pid] },
      { key: qk.clientName(pid), method: 'clientName', args: [pid] },
      { key: qk.stages(pid), method: 'stages', args: [pid] },
      { key: qk.documents(pid), method: 'documents', args: [pid] },
      { key: qk.contracts(pid), method: 'contracts', args: [pid] },
      { key: qk.payment(pid), method: 'payment', args: [pid] },
      { key: qk.quotes(pid), method: 'quotes', args: [pid] },
      { key: qk.suppliers(pid), method: 'suppliers', args: [pid] },
    ]),
    pid,
  );
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!r.ready) {
    return (
      <div className="printwrap">
        <div className="print-actions no-print">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <ArrowLeft size={14} /> Voltar
          </button>
        </div>
        <div className="doc-sheet">
          {r.error ? <ErrorBox /> : <Loading text="Montando histórico…" />}
        </div>
      </div>
    );
  }

  const db = r.db;
  const project = db.project(pid);
  if (!project) {
    return (
      <div className="printwrap">
        <div className="print-actions no-print">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <ArrowLeft size={14} /> Voltar
          </button>
        </div>
        <div className="doc-sheet">
          <ErrorBox text="Projeto não encontrado." />
        </div>
      </div>
    );
  }

  const stages = db.stages(pid);
  const docs = db.documents(pid);
  const contracts = db.contracts(pid);
  const pay = db.payment(pid);
  const quotes = db.quotes(pid);
  const suppliers = db.suppliers(pid);
  const typeLabel = (id) => (DOC_TYPES.find((t) => t.id === id) || { label: 'Geral' }).label;
  const stLabel = (id) => (STAGE_STATUS.find((s) => s.id === id) || { label: id }).label;
  return (
    <div className="printwrap">
      <div className="print-actions no-print">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          <ArrowLeft size={14} /> Voltar
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
          <Printer size={14} /> Imprimir / Salvar PDF
        </button>
      </div>
      <div className="doc-sheet">
        <div className="ds-head">
          <img className="ds-lockup" src="/brand/lockup.png" alt="Gabriela Lendecker — arquitetura e interiores" />
          <div className="ds-title">
            <h1>Histórico do projeto</h1>
            <p>Gerado em {fmt(todayISO())}</p>
          </div>
        </div>

        <table className="ds-info">
          <tbody>
            <tr>
              <th>Projeto</th>
              <td>
                {project.name} ({project.code})
              </td>
            </tr>
            <tr>
              <th>Cliente</th>
              <td>{db.clientName(project.id)}</td>
            </tr>
            <tr>
              <th>Endereço</th>
              <td>{project.address}</td>
            </tr>
            <tr>
              <th>Período</th>
              <td>
                {fmt(project.start)} a {fmt(project.due)}
              </td>
            </tr>
            <tr>
              <th>Situação</th>
              <td>
                {project.status === 'concluido'
                  ? 'Concluído em ' + fmt(project.completedAt)
                  : 'Em andamento'}
              </td>
            </tr>
          </tbody>
        </table>

        <h2 className="ds-sec">Linha do tempo</h2>
        {stages.map((s) => (
          <div key={s.id} className="ds-stage">
            <strong>{s.title}</strong> — {stLabel(s.status)} · {s.category} ·{' '}
            {s.owner === 'client' ? 'Cliente' : 'Studio'} · {fmt(s.start)}
            {s.end && s.end !== s.start ? ' a ' + fmt(s.end) : ''}
            {s.time ? ' ' + s.time : ''}
            {s.category === 'Reunião'
              ? s.presencial
                ? ' · Presencial'
                : ' · Online' + (s.link ? ' (' + s.link + ')' : '')
              : ''}
            <p>{s.desc}</p>
            {(s.subs || []).length > 0 && (
              <ul className="ds-sublist">
                {s.subs.map((b) => (
                  <li key={b.id}>
                    {b.done ? '✓' : '○'} {b.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        <h2 className="ds-sec">Documentos</h2>
        <ul className="ds-list">
          {docs.map((d) => (
            <li key={d.id}>
              {d.name} — {typeLabel(d.type)} ({fmt(d.date)})
            </li>
          ))}
        </ul>

        <h2 className="ds-sec">Contratos e termos</h2>
        {contracts.length === 0 ? (
          <p className="ds-stage">Sem documentos.</p>
        ) : (
          contracts.map((c) => (
            <p key={c.id} className="ds-stage">
              {(c.kind === 'termo' ? 'Termo: ' : 'Contrato: ') + c.name} —{' '}
              {c.sigStatus === 'assinado'
                ? 'assinado por ' + c.signer + ' em ' + fmt(c.signedAt) + ' via ' + c.provider
                : c.sigStatus === 'enviado'
                  ? 'enviado para assinatura'
                  : 'aguardando envio'}
            </p>
          ))
        )}

        <h2 className="ds-sec">Pagamentos</h2>
        {pay ? (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Parcela</th>
                <th>Valor</th>
                <th>Vencimento</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pay.installments.map((i) => (
                <tr key={i.n}>
                  <td>{i.n}</td>
                  <td>{money(i.amount)}</td>
                  <td>{fmt(i.due)}</td>
                  <td>{i.status === 'pago' ? 'Pago' : 'Em aberto'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>—</p>
        )}

        <h2 className="ds-sec">Orçamentos</h2>
        <ul className="ds-list">
          {quotes.map((q) => (
            <li key={q.id}>
              [{q.segment}] {q.supplier} — {money(q.amount)} · {q.status}
            </li>
          ))}
        </ul>

        <h2 className="ds-sec">Fornecedores contratados</h2>
        <ul className="ds-list">
          {suppliers.length ? (
            suppliers.map((q) => (
              <li key={q.id}>
                [{q.segment}] {q.supplier} — {money(q.amount)}
              </li>
            ))
          ) : (
            <li>—</li>
          )}
        </ul>

        <p className="ds-foot">
          {STUDIO.name} · {STUDIO.tagline}
        </p>
      </div>
    </div>
  );
}
