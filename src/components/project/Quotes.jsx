import { useState, useRef } from 'react';
import { Plus, Upload, FileText, ThumbsUp, ThumbsDown, MessageCircle, Trash2, Handshake, Send } from 'lucide-react';
import { erroAmigavel } from '../../lib/erros.js';
import { Empty } from '../atoms.jsx';
import { SEGMENTS, STUDIO } from '../../lib/constants.js';
import { money } from '../../lib/helpers.js';

export function Quotes({ db, project, isStudio }) {
  const quotes = db.quotes(project.id);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState({
    segment: SEGMENTS[0],
    supplier: '',
    amount: '',
    studioNote: '',
    fileName: '',
    file: null,
    contact: '',
    deadline: '',
    payment: '',
  });
  const cadastro = (isStudio && db.fornecedores && db.fornecedores()) || [];
  const [fornId, setFornId] = useState('');
  // escolher um fornecedor do cadastro preenche nome, segmento e contato
  const escolherFornecedor = (id) => {
    setFornId(id);
    const f = cadastro.find((x) => x.id === id);
    if (!f) return;
    setQ({
      ...q,
      supplier: f.name,
      segment: SEGMENTS.includes(f.segment) ? f.segment : q.segment,
      contact: [f.contact, f.phone, f.email].filter(Boolean).join(' · '),
    });
  };
  const [segFilter, setSegFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const fileRef = useRef(null);
  const resetQ = () =>
    setQ({
      segment: SEGMENTS[0],
      supplier: '',
      amount: '',
      studioNote: '',
      fileName: '',
      file: null,
      contact: '',
      deadline: '',
      payment: '',
    });
  const STATUS = [
    ['todos', 'Todos'],
    ['pendente', 'Pendentes'],
    ['aprovado', 'Aprovados'],
    ['negociacao', 'Em negociação'],
    ['reprovado', 'Reprovados'],
  ];
  const segsPresent = SEGMENTS.filter((s) => quotes.some((x) => x.segment === s));
  const filtered = quotes.filter(
    (x) =>
      (segFilter === 'todos' || x.segment === segFilter) &&
      (statusFilter === 'todos' || x.status === statusFilter),
  );
  const grouped = SEGMENTS.map((s) => ({
    seg: s,
    items: filtered.filter((x) => x.segment === s),
  })).filter((g) => g.items.length);

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Orçamentos de fornecedores</h2>
        {isStudio && (
          <button className="btn btn-ghost btn-sm" onClick={() => setAdding(!adding)}>
            <Plus size={14} /> Novo orçamento
          </button>
        )}
      </header>

      {adding && (
        <div className="add-stage">
          {cadastro.length > 0 && (
            <label className="lab">
              Fornecedor cadastrado
              <select value={fornId} onChange={(e) => escolherFornecedor(e.target.value)}>
                <option value="">Digitar um fornecedor novo</option>
                {cadastro.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {f.segment ? ' — ' + f.segment : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="add-row">
            <select value={q.segment} onChange={(e) => setQ({ ...q, segment: e.target.value })}>
              {SEGMENTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <input
              placeholder="Fornecedor" aria-label="Nome do fornecedor"
              value={q.supplier}
              onChange={(e) => setQ({ ...q, supplier: e.target.value })}
            />
          </div>
          <div className="add-row">
            <input
              type="number"
              placeholder="Valor (R$)" aria-label="Valor do orçamento em reais"
              value={q.amount}
              onChange={(e) => setQ({ ...q, amount: e.target.value })}
            />
            <div className="file-pick">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => fileRef.current && fileRef.current.click()}
              >
                <Upload size={14} /> {q.fileName ? 'Trocar arquivo' : 'Anexar PDF'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                hidden
                onChange={(e) => {
                  const f = e.target.files && e.target.files[0];
                  if (f) setQ({ ...q, fileName: f.name, file: f });
                  e.target.value = '';
                }}
              />
              {q.fileName && (
                <span className="file-name">
                  <FileText size={13} /> {q.fileName}
                </span>
              )}
            </div>
          </div>
          <div className="add-row">
            <input
              placeholder="Contato (nome · telefone · e-mail)"
              aria-label="Contato do fornecedor"
              value={q.contact}
              onChange={(e) => setQ({ ...q, contact: e.target.value })}
            />
            <input
              placeholder="Prazo de entrega (ex.: 45 dias)"
              aria-label="Prazo de entrega"
              value={q.deadline}
              onChange={(e) => setQ({ ...q, deadline: e.target.value })}
            />
            <input
              placeholder="Condições de pagamento"
              aria-label="Condições de pagamento"
              value={q.payment}
              onChange={(e) => setQ({ ...q, payment: e.target.value })}
            />
          </div>
          <textarea
            placeholder="Nota para o cliente (aparece antes da decisão)" aria-label="Nota para o cliente"
            value={q.studioNote}
            onChange={(e) => setQ({ ...q, studioNote: e.target.value })}
          />
          <div className="row">
            <button
              className="btn btn-primary btn-sm"
              disabled={!q.supplier.trim() || !q.amount}
              onClick={() => {
                db.addQuote(project.id, q, q.file);
                resetQ();
                setFornId('');
                setAdding(false);
              }}
            >
              Publicar orçamento
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                resetQ();
                setAdding(false);
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {quotes.length > 0 && (
        <div className="quote-filters">
          <select
            className="mini-select"
            value={segFilter}
            onChange={(e) => setSegFilter(e.target.value)}
          >
            <option value="todos">Todos os segmentos</option>
            {segsPresent.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="filter-row">
            {STATUS.map(([v, l]) => (
              <button
                key={v}
                className={'filter' + (statusFilter === v ? ' on' : '')}
                onClick={() => setStatusFilter(v)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {quotes.length === 0 ? (
        <Empty text="Nenhum orçamento publicado ainda." />
      ) : grouped.length === 0 ? (
        <Empty text="Nenhum orçamento neste filtro." />
      ) : (
        grouped.map((g) => (
          <div key={g.seg} className="seg-block">
            <h4 className="seg-title">{g.seg}</h4>
            {g.items.map((x) => (
              <QuoteCard key={x.id} db={db} q={x} isStudio={isStudio} />
            ))}
          </div>
        ))
      )}
    </section>
  );
}

function QuoteCard({ db, q, isStudio }) {
  const [note, setNote] = useState(q.studioNote);
  const [editNote, setEditNote] = useState(false);
  const [comment, setComment] = useState('');
  const badge = {
    pendente: ['pill-next', 'Pendente'],
    aprovado: ['pill-done', 'Aprovado'],
    reprovado: ['pill-late', 'Reprovado'],
    negociacao: ['pill-neg', 'Em negociação'],
  }[q.status] || ['pill-next', q.status];
  return (
    <div className="quote">
      <div className="quote-top">
        <div>
          <strong>{q.supplier}</strong>
          <span className="quote-val">{money(q.amount)}</span>
        </div>
        <div className="quote-top-right">
          <span className={'pill ' + badge[0]}>{badge[1]}</span>
          {isStudio && (
            <button
              className="icon-btn icon-del sm-del"
              title="Excluir orçamento"
              onClick={() => {
                if (window.confirm('Excluir o orçamento de "' + q.supplier + '"?'))
                  db.deleteQuote(q.id);
              }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="quote-file">
        <FileText size={14} />{' '}
        {q.fileName ? (
          <>
            {q.fileName}
            <button
              className="link sm"
              onClick={async () => {
                if (!q.storagePath) return;
                try {
                  const u = await db.fileUrl(q.storagePath);
                  if (u) window.open(u, '_blank', 'noopener');
                } catch {
                  /* sem arquivo */
                }
              }}
            >
              abrir
            </button>
          </>
        ) : (
          <em className="muted-line">Sem arquivo anexado</em>
        )}
      </div>

      {(q.contact || q.deadline || q.payment) && (
        <p className="quote-dados">
          {[q.contact, q.deadline && 'Prazo: ' + q.deadline, q.payment && 'Pagamento: ' + q.payment]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      {(q.studioNote || isStudio) && (
        <div className="quote-note">
          <span className="note-tag">Nota do studio</span>
          {isStudio && editNote ? (
            <>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="row">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    db.setQuoteNote(q.id, note);
                    setEditNote(false);
                  }}
                >
                  Salvar
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setNote(q.studioNote);
                    setEditNote(false);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <p>
              {q.studioNote || <em className="muted-line">Sem nota.</em>}{' '}
              {isStudio && (
                <button className="link sm" onClick={() => setEditNote(true)}>
                  editar
                </button>
              )}
            </p>
          )}
        </div>
      )}

      {q.comments.length > 0 && (
        <div className="quote-comments">
          {q.comments.map((c, i) => (
            <div key={i} className={'qc ' + (c.author === 'studio' ? 'qc-studio' : 'qc-client')}>
              <strong>{c.author === 'studio' ? STUDIO.name : 'Cliente'}</strong>
              <span>{c.body}</span>
              <em>{c.at}</em>
            </div>
          ))}
        </div>
      )}

      <div className="quote-actions">
        {!isStudio && q.status === 'pendente' && <DecisaoCliente db={db} q={q} />}
        {!isStudio && q.status === 'negociacao' && (
          <p className="hint">Você pediu uma negociação. O studio vai conversar com o fornecedor e atualizar o orçamento.</p>
        )}
        {isStudio && q.status === 'negociacao' && <ReenviarOrcamento db={db} q={q} />}
        <div className="comment-box">
          <input
            placeholder="Comentar…" aria-label="Escrever um comentário"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && comment.trim()) {
                db.addComment(q.id, isStudio ? 'studio' : 'client', comment.trim());
                setComment('');
              }
            }}
          />
          <button
            className="icon-btn"
            onClick={() => {
              if (comment.trim()) {
                db.addComment(q.id, isStudio ? 'studio' : 'client', comment.trim());
                setComment('');
              }
            }}
          >
            <MessageCircle size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function DecisaoCliente({ db, q }) {
  const [negociando, setNegociando] = useState(false);
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const decidir = async (decisao, mensagem) => {
    setErro('');
    setOcupado(true);
    try {
      await db.decidirOrcamento(q.id, decisao, mensagem);
      setNegociando(false);
    } catch (e) {
      setErro(erroAmigavel(e).texto);
    } finally {
      setOcupado(false);
    }
  };
  if (negociando)
    return (
      <div className="sign-box negociar">
        <label className="lab">
          O que você gostaria de negociar?
          <textarea
            rows={3}
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Ex.: o valor está acima do que planejei; é possível rever o acabamento ou parcelar?"
          />
        </label>
        {erro && <p className="error">{erro}</p>}
        <div className="row">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!msg.trim() || ocupado}
            onClick={() => decidir('negociar', msg.trim())}
          >
            <Send size={13} /> {ocupado ? 'Enviando…' : 'Enviar pedido'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNegociando(false)}>
            Voltar
          </button>
        </div>
      </div>
    );
  return (
    <>
      <button className="btn btn-primary btn-sm" disabled={ocupado} onClick={() => decidir('aprovar')}>
        <ThumbsUp size={13} /> Aprovar
      </button>
      <button className="btn btn-ghost btn-sm" disabled={ocupado} onClick={() => setNegociando(true)}>
        <Handshake size={13} /> Pedir negociação
      </button>
      <button className="btn btn-ghost btn-sm" disabled={ocupado} onClick={() => decidir('reprovar')}>
        <ThumbsDown size={13} /> Reprovar
      </button>
      {erro && <span className="error">{erro}</span>}
    </>
  );
}

// Studio: depois de negociar com o fornecedor, atualiza o valor (se mudou) e
// devolve o orçamento ao cliente para uma nova decisão.
function ReenviarOrcamento({ db, q }) {
  const [valor, setValor] = useState(String(q.amount));
  return (
    <div className="reenviar">
      <span className="hint">O cliente pediu negociação (veja o comentário abaixo).</span>
      <input
        type="number"
        aria-label="Novo valor do orçamento em reais"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
      />
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={!(Number(valor) > 0)}
        onClick={() => db.updateQuote(q.id, { amount: Number(valor), status: 'pendente' })}
      >
        <Send size={13} /> Reenviar ao cliente
      </button>
    </div>
  );
}
