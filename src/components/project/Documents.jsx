import { useState, useRef } from 'react';
import { Upload, FileText, Download, Trash2, Check, PenLine } from 'lucide-react';
import { AssinaturaPortal } from './Assinatura.jsx';
import { erroAmigavel } from '../../lib/erros.js';
import { Empty } from '../atoms.jsx';
import { DOC_TYPES } from '../../lib/constants.js';
import { fmt, validarArquivo } from '../../lib/helpers.js';

export function Documents({ db, project, isStudio }) {
  const docs = db.documents(project.id);
  const [filter, setFilter] = useState('');
  const [type, setType] = useState('geral');
  // o que a Gabriela pede ao cliente ao enviar: nada, só um OK, ou assinatura
  const [pedido, setPedido] = useState('nenhuma');
  const fileRef = useRef(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');
  const onPick = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const problema = validarArquivo(f);
    if (problema) {
      setAviso(problema);
      return;
    }
    setAviso('');
    setEnviando(true);
    try {
      await db.addDocument(
        project.id,
        { name: f.name, type, approval: pedido, size: (f.size / 1048576).toFixed(1).replace('.', ',') + ' MB' },
        f,
      );
    } finally {
      setEnviando(false);
    }
  };
  const openDoc = async (d) => {
    if (!d.storagePath) return;
    try {
      const url = await db.fileUrl(d.storagePath);
      if (url) window.open(url, '_blank', 'noopener');
    } catch {
      /* ignora — sem arquivo disponível */
    }
  };
  const shown = !filter ? docs : docs.filter((d) => d.type === filter);
  const typeLabel = (id) => (DOC_TYPES.find((t) => t.id === id) || { label: 'Geral' }).label;
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Documentos</h2>
        {isStudio && (
          <div className="head-actions">
            <select className="mini-select" value={type} onChange={(e) => setType(e.target.value)}>
              {DOC_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              className="mini-select"
              value={pedido}
              onChange={(e) => setPedido(e.target.value)}
              aria-label="O que pedir ao cliente"
            >
              {PEDIDOS.map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
            <button disabled={enviando}
              className="btn btn-ghost btn-sm"
              onClick={() => fileRef.current && fileRef.current.click()}
            >
              <Upload size={14} /> Enviar PDF
            </button>
            <input ref={fileRef} type="file" accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx" hidden onChange={onPick} />
            {aviso && <p className="micro aviso-upload">{aviso}</p>}
          </div>
        )}
      </header>
      <div className="filter-row">
        {DOC_TYPES.map((t) => (
          <button
            key={t.id}
            className={'filter' + (filter === t.id ? ' on' : '')}
            onClick={() => setFilter(filter === t.id ? '' : t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <Empty text={filter ? 'Nenhum documento nesta categoria.' : 'Nenhum documento ainda.'} />
      ) : (
        <ul className="doc-list">
          {shown.map((d) => (
            <li key={d.id} className="doc">
              <span className="doc-ic">
                <FileText size={18} />
              </span>
              <span className="doc-meta">
                <strong>{d.name}</strong>
                <small>
                  {typeLabel(d.type)} · {d.size} · {fmt(d.date)}
                </small>
                <SituacaoDoc d={d} />
              </span>
              <button
                className="icon-btn"
                title={d.storagePath ? 'Baixar' : 'Arquivo indisponível'}
                onClick={() => openDoc(d)}
                disabled={!d.storagePath}
              >
                <Download size={16} />
              </button>
              {isStudio && (
                <select
                  className="mini-select doc-pedido"
                  aria-label={'O que pedir ao cliente sobre ' + d.name}
                  value={d.approval || 'nenhuma'}
                  onChange={(e) => {
                    const novo = e.target.value;
                    if (d.response && !window.confirm('O cliente já respondeu este documento. Pedir de novo apaga a resposta anterior. Continuar?')) return;
                    db.setDocumentApproval(d.id, novo);
                  }}
                >
                  {PEDIDOS.map(([v, r]) => (
                    <option key={v} value={v}>
                      {r}
                    </option>
                  ))}
                </select>
              )}
              {isStudio && (
                <button
                  className="icon-btn icon-del"
                  title="Excluir"
                  onClick={() => {
                    if (window.confirm('Excluir "' + d.name + '"?')) db.deleteDocument(d.id);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              )}
              {!isStudio && <RespostaCliente db={db} d={d} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const PEDIDOS = [
  ['nenhuma', 'Sem pedido ao cliente'],
  ['ok', 'Pedir OK do cliente'],
  ['assinatura', 'Pedir assinatura'],
];

const dataCurta = (iso) => (iso ? fmt(String(iso).slice(0, 10)) : '');

function SituacaoDoc({ d }) {
  if (!d.approval || d.approval === 'nenhuma') return null;
  if (d.response === 'assinado')
    return <span className="doc-sit ok">Assinado por {d.respondedName} em {dataCurta(d.respondedAt)}</span>;
  if (d.response === 'aprovado')
    return <span className="doc-sit ok">OK do cliente em {dataCurta(d.respondedAt)}</span>;
  return (
    <span className="doc-sit pendente">{d.approval === 'assinatura' ? 'Aguardando assinatura do cliente' : 'Aguardando OK do cliente'}</span>
  );
}

function RespostaCliente({ db, d }) {
  const [assinando, setAssinando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  if (!d.approval || d.approval === 'nenhuma' || d.response) return null;

  if (d.approval === 'ok')
    return (
      <span className="doc-resposta">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={enviando}
          onClick={async () => {
            setErro('');
            setEnviando(true);
            try {
              await db.responderDocumento(d.id);
            } catch (e) {
              setErro(erroAmigavel(e).texto);
            } finally {
              setEnviando(false);
            }
          }}
        >
          <Check size={13} /> {enviando ? 'Enviando…' : 'Dar OK'}
        </button>
        {erro && <span className="error">{erro}</span>}
      </span>
    );

  return assinando ? (
    <div className="doc-assinar">
      <AssinaturaPortal
        titulo={d.name}
        onAssinar={async (nome) => {
          await db.responderDocumento(d.id, nome);
          setAssinando(false);
        }}
        onCancelar={() => setAssinando(false)}
      />
    </div>
  ) : (
    <button type="button" className="btn btn-primary btn-sm doc-resposta" onClick={() => setAssinando(true)}>
      <PenLine size={13} /> Assinar
    </button>
  );
}
