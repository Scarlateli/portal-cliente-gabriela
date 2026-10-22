import { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Download, Trash2, Check, PenLine, Pencil, RefreshCw, MessageSquareWarning, MessageSquare, Send } from 'lucide-react';
import { AssinaturaPortal } from './Assinatura.jsx';
import { EnviosCliente } from './EnviosCliente.jsx';
import { erroAmigavel } from '../../lib/erros.js';
import { Empty } from '../atoms.jsx';
import { DOC_TYPES } from '../../lib/constants.js';
import { fmt, validarArquivo } from '../../lib/helpers.js';
import { IS_SUPABASE } from '../../lib/data.js';

/* Documentos do projeto, em duas partes:
   - Documentos: o que o studio publica (atas, plantas, briefing…), com
     pedido de confirmação ou de assinatura ao cliente;
   - Envios do cliente: os pedidos de arquivo, onde o cliente manda o que
     o studio precisa (vários arquivos por pedido). */
export function Documents({ db, project, isStudio, alvo = null, abrir = () => {} }) {
  const [parte, setParte] = useState(() => (alvo && String(alvo).startsWith('pedido-') ? 'envios' : 'docs'));
  useEffect(() => {
    if (alvo && String(alvo).startsWith('pedido-')) setParte('envios');
    else if (alvo && String(alvo).startsWith('doc-')) setParte('docs');
  }, [alvo]);
  const pedidos = db
    .stages(project.id)
    .flatMap((s) => (s.subs || []).filter((b) => b.pedeArquivos))
    .filter((b) => !b.done).length;

  return (
    <>
      <div className="doc-partes" role="tablist" aria-label="Partes de Documentos">
        <button
          type="button"
          role="tab"
          aria-selected={parte === 'docs'}
          className={'filter' + (parte === 'docs' ? ' on' : '')}
          onClick={() => setParte('docs')}
        >
          Documentos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={parte === 'envios'}
          className={'filter' + (parte === 'envios' ? ' on' : '')}
          onClick={() => setParte('envios')}
        >
          Envios do Cliente{pedidos ? ' · ' + pedidos + (pedidos === 1 ? ' aberto' : ' abertos') : ''}
        </button>
      </div>
      {parte === 'docs' ? (
        <DocumentosStudio db={db} project={project} isStudio={isStudio} />
      ) : (
        <EnviosCliente db={db} project={project} isStudio={isStudio} abrir={abrir} />
      )}
    </>
  );
}

// rodada 5: só "sem pedido" ou "pedir aprovação" (a assinatura saiu; um
// documento antigo que já pedia assinatura continua mostrando a opção)
const PEDIDOS = [
  ['nenhuma', 'Sem pedido ao cliente'],
  ['ok', 'Pedir aprovação do cliente'],
];
const pedidosPara = (d) => (d && d.approval === 'assinatura' ? [...PEDIDOS, ['assinatura', 'Pedir assinatura']] : PEDIDOS);
const textoAviso = (d, approval) =>
  (approval === 'assinatura' ? 'Assinar o documento "' : 'Aprovar o documento "') + d.name + '"';

function DocumentosStudio({ db, project, isStudio }) {
  const docs = db.documents(project.id);
  const [filter, setFilter] = useState('');
  const [type, setType] = useState('geral');
  // o que a Gabriela pede ao cliente ao enviar: nada, uma confirmação, ou assinatura
  const [pedido, setPedido] = useState('nenhuma');
  const [avisar, setAvisar] = useState(IS_SUPABASE);
  const fileRef = useRef(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [editando, setEditando] = useState(null);
  const [novo, setNovo] = useState(false);
  const [arquivo, setArquivo] = useState(null);
  const fecharNovo = () => {
    setNovo(false);
    setArquivo(null);
    setPedido('nenhuma');
  };

  const avisarCliente = async (texto) => {
    if (!avisar || !IS_SUPABASE) return;
    try {
      const r = await db.avisarCliente(project.id, texto);
      setAviso(r && r.emailSent ? 'Cliente avisado por e-mail.' : 'O e-mail ao cliente não foi enviado.');
    } catch {
      setAviso('O e-mail ao cliente não foi enviado.');
    }
  };
  const onPick = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const problema = validarArquivo(f);
    setAviso(problema || '');
    setArquivo(problema ? null : f);
  };
  const enviar = async () => {
    const f = arquivo;
    if (!f || enviando) return;
    setEnviando(true);
    try {
      await db.addDocument(
        project.id,
        { name: f.name, type, approval: pedido, size: (f.size / 1048576).toFixed(1).replace('.', ',') + ' MB' },
        f,
      );
      if (pedido !== 'nenhuma') await avisarCliente(textoAviso({ name: f.name }, pedido));
      fecharNovo();
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
  const typeLabel = (id) => (DOC_TYPES.find((t) => t.id === id) || { label: 'Documentos Gerais' }).label;
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Documentos</h2>
        {isStudio && !novo && (
          <button className="btn btn-ghost btn-sm" onClick={() => setNovo(true)}>
            <Upload size={14} /> Enviar Documento
          </button>
        )}
      </header>
      {isStudio && novo && (
        <div className="add-stage doc-novo">
          <div className="doc-novo-grade">
            <label className="lab">
              Arquivo
              <span className="doc-arquivo">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current && fileRef.current.click()}>
                  <Upload size={13} /> {arquivo ? 'Trocar arquivo' : 'Escolher arquivo'}
                </button>
                <span className="micro">{arquivo ? arquivo.name : 'PDF, imagem ou documento do Office, até 20 MB'}</span>
              </span>
              <input ref={fileRef} type="file" accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx" hidden onChange={onPick} />
            </label>
            <label className="lab">
              Categoria
              <select aria-label="Categoria do documento" value={type} onChange={(e) => setType(e.target.value)}>
                {DOC_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="doc-opcao">
            <input type="checkbox" checked={pedido === 'ok'} onChange={(e) => setPedido(e.target.checked ? 'ok' : 'nenhuma')} /> Pedir
            aprovação do cliente
          </label>
          {IS_SUPABASE && (
            <label className={'doc-opcao' + (pedido === 'nenhuma' ? ' doc-opcao-off' : '')}>
              <input type="checkbox" disabled={pedido === 'nenhuma'} checked={avisar && pedido !== 'nenhuma'} onChange={(e) => setAvisar(e.target.checked)} />{' '}
              Notificar cliente via e-mail
            </label>
          )}
          {aviso && <p className="micro aviso-upload">{aviso}</p>}
          <div className="row">
            <button type="button" className="btn btn-primary btn-sm" disabled={!arquivo || enviando} onClick={enviar}>
              {enviando ? 'Enviando…' : 'Enviar'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={fecharNovo}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {isStudio && !novo && aviso && <p className="micro aviso-upload">{aviso}</p>}
      <div className="filter-row">
        {DOC_TYPES.map((t) => (
          <button key={t.id} className={'filter' + (filter === t.id ? ' on' : '')} onClick={() => setFilter(filter === t.id ? '' : t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <Empty text={filter ? 'Nenhum documento nesta categoria.' : 'Nenhum documento ainda.'} />
      ) : (
        <ul className="doc-list">
          {shown.map((d) =>
            editando === d.id ? (
              <EditarDocumento key={d.id} db={db} d={d} projectId={project.id} onFechar={() => setEditando(null)} />
            ) : (
              <li key={d.id} className="doc" id={'alvo-doc-' + d.id}>
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
                <button className="icon-btn" title={d.storagePath ? 'Abrir' : 'Arquivo indisponível'} aria-label={'Abrir ' + d.name} onClick={() => openDoc(d)} disabled={!d.storagePath}>
                  <Download size={16} />
                </button>
                {isStudio && (
                  <select
                    className="mini-select doc-pedido"
                    aria-label={'O que pedir ao cliente sobre ' + d.name}
                    value={d.approval || 'nenhuma'}
                    onChange={async (e) => {
                      const novo = e.target.value;
                      if (d.response && !window.confirm('O cliente já respondeu este documento. Pedir de novo apaga a resposta anterior. Continuar?')) return;
                      await db.setDocumentApproval(d.id, novo);
                      if (novo !== 'nenhuma') await avisarCliente(textoAviso(d, novo));
                    }}
                  >
                    {pedidosPara(d).map(([v, r]) => (
                      <option key={v} value={v}>
                        {r}
                      </option>
                    ))}
                  </select>
                )}
                {isStudio && (
                  <button className="icon-btn" title="Editar" aria-label={'Editar ' + d.name} onClick={() => setEditando(d.id)}>
                    <Pencil size={15} />
                  </button>
                )}
                {isStudio && (
                  <button
                    className="icon-btn icon-del"
                    title="Excluir"
                    aria-label={'Excluir ' + d.name}
                    onClick={() => {
                      if (window.confirm('Excluir "' + d.name + '"?')) db.deleteDocument(d.id);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                {isStudio && d.response === 'ajustes' && (
                  <button
                    type="button"
                    className="link sm doc-pedir-de-novo"
                    onClick={async () => {
                      await db.setDocumentApproval(d.id, d.approval);
                      await avisarCliente(textoAviso(d, d.approval));
                    }}
                  >
                    <Send size={12} /> Ajustei, pedir de novo
                  </button>
                )}
                {!isStudio && <RespostaCliente db={db} d={d} />}
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

/* Editar nome e categoria, ou trocar o arquivo (studio). */
function EditarDocumento({ db, d, projectId, onFechar }) {
  const [nome, setNome] = useState(d.name);
  const [tipo, setTipo] = useState(d.type);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState('');
  const arq = useRef(null);
  const salvar = async () => {
    if (!nome.trim() || salvando) return;
    setSalvando(true);
    try {
      await db.updateDocument(d.id, { name: nome.trim(), type: tipo });
      onFechar();
    } catch {
      setSalvando(false);
    }
  };
  const trocar = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const problema = validarArquivo(f);
    if (problema) return setAviso(problema);
    setSalvando(true);
    try {
      await db.replaceDocumentFile(projectId, d.id, f);
      setAviso('Arquivo trocado.');
    } finally {
      setSalvando(false);
    }
  };
  return (
    <li className="doc doc-editando" id={'alvo-doc-' + d.id}>
      <div className="form-grid">
        <label className="lab">
          Nome do documento
          <input value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome do documento" />
        </label>
        <label className="lab">
          Categoria
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Categoria">
            {!DOC_TYPES.some((t) => t.id === tipo) && <option value={tipo}>Documentos Gerais</option>}
            {DOC_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="row">
        <button type="button" className="btn btn-primary btn-sm" disabled={!nome.trim() || salvando} onClick={salvar}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={salvando} onClick={() => arq.current && arq.current.click()}>
          <RefreshCw size={13} /> Trocar o arquivo
        </button>
        <input ref={arq} type="file" accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx" hidden onChange={trocar} />
        <button type="button" className="btn btn-ghost btn-sm" onClick={onFechar}>
          Fechar
        </button>
        {aviso && <span className="micro">{aviso}</span>}
      </div>
    </li>
  );
}

const dataCurta = (iso) => (iso ? fmt(String(iso).slice(0, 10)) : '');

function SituacaoDoc({ d }) {
  if (!d.approval || d.approval === 'nenhuma') return null;
  // comentário que o cliente deixou ao aprovar ou assinar (rodada 8)
  const comentario = d.responseNote ? (
    <span className="doc-comentario">
      <MessageSquare size={12} /> Comentário do cliente: “{d.responseNote}”
    </span>
  ) : null;
  if (d.response === 'assinado')
    return (
      <>
        <span className="doc-sit ok">
          Assinado por {d.respondedName} em {dataCurta(d.respondedAt)}
        </span>
        {comentario}
      </>
    );
  if (d.response === 'aprovado')
    return (
      <>
        <span className="doc-sit ok">
          Aprovado por {d.respondedName || 'cliente'} em {dataCurta(d.respondedAt)}
        </span>
        {comentario}
      </>
    );
  if (d.response === 'ajustes')
    return (
      <span className="doc-sit pendente">
        <MessageSquareWarning size={12} /> Ajustes pedidos em {dataCurta(d.respondedAt)}: “{d.responseNote}”
      </span>
    );
  return (
    <span className="doc-sit pendente">
      {d.approval === 'assinatura' ? 'Aguardando assinatura do cliente' : 'Aguardando aprovação do cliente'}
    </span>
  );
}

/* Resposta do cliente: confirmar (ou assinar) ou pedir ajustes. */
function RespostaCliente({ db, d }) {
  const [modo, setModo] = useState(null); // 'assinar' | 'ajustes' | null
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  if (!d.approval || d.approval === 'nenhuma' || d.response) return null;

  const enviar = async (fn) => {
    setErro('');
    setEnviando(true);
    try {
      await fn();
      setModo(null);
    } catch (e) {
      setErro(erroAmigavel(e).texto);
    } finally {
      setEnviando(false);
    }
  };

  if (modo === 'assinar')
    return (
      <div className="doc-assinar">
        <AssinaturaPortal
          titulo={d.name}
          onAssinar={async (nome) => {
            await db.responderDocumento(d.id, nome, 'confirmar', msg.trim() || null);
            setModo(null);
          }}
          onCancelar={() => setModo(null)}
        />
      </div>
    );

  if (modo === 'ajustes')
    return (
      <div className="doc-assinar doc-ajustes">
        <label className="lab">
          O que precisa ser ajustado em “{d.name}”?
          <textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} aria-label="O que precisa ser ajustado" />
        </label>
        <div className="row">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!msg.trim() || enviando}
            onClick={() => enviar(() => db.responderDocumento(d.id, null, 'ajustes', msg.trim()))}
          >
            {enviando ? 'Enviando…' : 'Enviar pedido de ajustes'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModo(null)}>
            Voltar
          </button>
        </div>
        {erro && <span className="error">{erro}</span>}
      </div>
    );

  return (
    <div className="doc-confirmar">
      <p className="doc-confirmar-texto">
        {d.approval === 'assinatura'
          ? 'O studio pede a sua assinatura neste documento.'
          : 'O studio pede a sua aprovação deste documento.'}
      </p>
      {/* rodada 8: o cliente pode comentar ao aprovar; para pedir ajustes,
          o comentário vira a mensagem (e é obrigatório) */}
      <label className="lab doc-comentar">
        Comentário (opcional)
        <textarea
          rows={2}
          maxLength={2000}
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Escreva aqui se quiser deixar uma observação para o studio"
          aria-label="Comentário para o studio"
        />
      </label>
      <div className="row">
        {d.approval === 'assinatura' ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setModo('assinar')}>
            <PenLine size={13} /> Assinar
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={enviando}
            onClick={() => enviar(() => db.responderDocumento(d.id, null, 'confirmar', msg.trim() || null))}
          >
            <Check size={13} /> {enviando ? 'Enviando…' : 'Aprovo'}
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModo('ajustes')}>
          <MessageSquareWarning size={13} /> Pedir ajustes
        </button>
      </div>
      {erro && <span className="error">{erro}</span>}
    </div>
  );
}
