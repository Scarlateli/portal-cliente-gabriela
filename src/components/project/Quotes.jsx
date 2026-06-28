import { useState, useRef } from 'react';
import { Plus, Upload, FileText, ThumbsUp, ThumbsDown, MessageCircle, Trash2 } from 'lucide-react';
import { Empty } from '../atoms.jsx';
import { SEGMENTS, STUDIO } from '../../lib/constants.js';
import { money } from '../../lib/helpers.js';

export function Quotes({ db, project, isStudio }) {
  const quotes = db.quotes(project.id);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState({ segment: SEGMENTS[0], supplier: '', amount: '', studioNote: '', fileName: '' });
  const [segFilter, setSegFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const fileRef = useRef(null);
  const resetQ = () => setQ({ segment: SEGMENTS[0], supplier: '', amount: '', studioNote: '', fileName: '' });
  const STATUS = [['todos', 'Todos'], ['pendente', 'Pendentes'], ['aprovado', 'Aprovados'], ['reprovado', 'Reprovados']];
  const segsPresent = SEGMENTS.filter((s) => quotes.some((x) => x.segment === s));
  const filtered = quotes.filter((x) => (segFilter === 'todos' || x.segment === segFilter) && (statusFilter === 'todos' || x.status === statusFilter));
  const grouped = SEGMENTS.map((s) => ({ seg: s, items: filtered.filter((x) => x.segment === s) })).filter((g) => g.items.length);

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Orçamentos de fornecedores</h2>
        {isStudio && <button className="btn btn-ghost btn-sm" onClick={() => setAdding(!adding)}><Plus size={14} /> Novo orçamento</button>}
      </header>

      {adding && (
        <div className="add-stage">
          <div className="add-row">
            <select value={q.segment} onChange={(e) => setQ({ ...q, segment: e.target.value })}>{SEGMENTS.map((s) => <option key={s}>{s}</option>)}</select>
            <input placeholder="Fornecedor" value={q.supplier} onChange={(e) => setQ({ ...q, supplier: e.target.value })} />
          </div>
          <div className="add-row">
            <input type="number" placeholder="Valor (R$)" value={q.amount} onChange={(e) => setQ({ ...q, amount: e.target.value })} />
            <div className="file-pick">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current && fileRef.current.click()}><Upload size={14} /> {q.fileName ? 'Trocar arquivo' : 'Anexar PDF'}</button>
              <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) setQ({ ...q, fileName: f.name }); e.target.value = ''; }} />
              {q.fileName && <span className="file-name"><FileText size={13} /> {q.fileName}</span>}
            </div>
          </div>
          <textarea placeholder="Nota para o cliente (aparece antes da decisão)" value={q.studioNote} onChange={(e) => setQ({ ...q, studioNote: e.target.value })} />
          <div className="row">
            <button className="btn btn-primary btn-sm" disabled={!q.supplier.trim() || !q.amount} onClick={() => { db.addQuote(project.id, q); resetQ(); setAdding(false); }}>Publicar orçamento</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { resetQ(); setAdding(false); }}>Cancelar</button>
          </div>
        </div>
      )}

      {quotes.length > 0 && (
        <div className="quote-filters">
          <select className="mini-select" value={segFilter} onChange={(e) => setSegFilter(e.target.value)}>
            <option value="todos">Todos os segmentos</option>
            {segsPresent.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="filter-row">
            {STATUS.map(([v, l]) => <button key={v} className={'filter' + (statusFilter === v ? ' on' : '')} onClick={() => setStatusFilter(v)}>{l}</button>)}
          </div>
        </div>
      )}

      {quotes.length === 0 ? <Empty text="Nenhum orçamento publicado ainda." />
        : grouped.length === 0 ? <Empty text="Nenhum orçamento neste filtro." />
        : grouped.map((g) => (
          <div key={g.seg} className="seg-block">
            <h4 className="seg-title">{g.seg}</h4>
            {g.items.map((x) => <QuoteCard key={x.id} db={db} q={x} isStudio={isStudio} />)}
          </div>
        ))}
    </section>
  );
}

function QuoteCard({ db, q, isStudio }) {
  const [note, setNote] = useState(q.studioNote);
  const [editNote, setEditNote] = useState(false);
  const [comment, setComment] = useState('');
  const badge = { pendente: ['pill-next', 'Pendente'], aprovado: ['pill-done', 'Aprovado'], reprovado: ['pill-late', 'Reprovado'] }[q.status];
  return (
    <div className="quote">
      <div className="quote-top">
        <div><strong>{q.supplier}</strong><span className="quote-val">{money(q.amount)}</span></div>
        <div className="quote-top-right">
          <span className={'pill ' + badge[0]}>{badge[1]}</span>
          {isStudio && <button className="icon-btn icon-del sm-del" title="Excluir orçamento" onClick={() => { if (window.confirm('Excluir o orçamento de "' + q.supplier + '"?')) db.deleteQuote(q.id); }}><Trash2 size={14} /></button>}
        </div>
      </div>
      <div className="quote-file"><FileText size={14} /> {q.fileName ? <>{q.fileName}<button className="link sm">abrir</button></> : <em className="muted-line">Sem arquivo anexado</em>}</div>

      {(q.studioNote || isStudio) && (
        <div className="quote-note">
          <span className="note-tag">Nota do studio</span>
          {isStudio && editNote ? (
            <>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="row"><button className="btn btn-primary btn-sm" onClick={() => { db.setQuoteNote(q.id, note); setEditNote(false); }}>Salvar</button><button className="btn btn-ghost btn-sm" onClick={() => { setNote(q.studioNote); setEditNote(false); }}>Cancelar</button></div>
            </>
          ) : (
            <p>{q.studioNote || <em className="muted-line">Sem nota.</em>} {isStudio && <button className="link sm" onClick={() => setEditNote(true)}>editar</button>}</p>
          )}
        </div>
      )}

      {q.comments.length > 0 && (
        <div className="quote-comments">
          {q.comments.map((c, i) => <div key={i} className={'qc ' + (c.author === 'studio' ? 'qc-studio' : 'qc-client')}><strong>{c.author === 'studio' ? STUDIO.name : 'Cliente'}</strong><span>{c.body}</span><em>{c.at}</em></div>)}
        </div>
      )}

      <div className="quote-actions">
        {!isStudio && q.status === 'pendente' && (
          <>
            <button className="btn btn-primary btn-sm" onClick={() => db.setQuoteStatus(q.id, 'aprovado')}><ThumbsUp size={13} /> Aprovar</button>
            <button className="btn btn-ghost btn-sm" onClick={() => db.setQuoteStatus(q.id, 'reprovado')}><ThumbsDown size={13} /> Reprovar</button>
          </>
        )}
        <div className="comment-box">
          <input placeholder="Comentar…" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && comment.trim()) { db.addComment(q.id, isStudio ? 'studio' : 'client', comment.trim()); setComment(''); } }} />
          <button className="icon-btn" onClick={() => { if (comment.trim()) { db.addComment(q.id, isStudio ? 'studio' : 'client', comment.trim()); setComment(''); } }}><MessageCircle size={15} /></button>
        </div>
      </div>
    </div>
  );
}
