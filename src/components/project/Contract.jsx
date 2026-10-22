import { useState, useEffect } from 'react';
import { IS_SUPABASE } from '../../lib/data.js';
import { ShieldCheck, PenLine, Plus, FileText, Trash2, Send, Check, X, RotateCcw, Pencil, Download } from 'lucide-react';
import { Empty } from '../atoms.jsx';
import { SIG_PROVIDERS } from '../../lib/constants.js';
import { fmt, todayISO, validarArquivo } from '../../lib/helpers.js';
import { erroAmigavel } from '../../lib/erros.js';
import { AssinaturaPortal } from './Assinatura.jsx';
import { metodoDe } from '../../lib/contratos.js';
import { useAvisos } from '../../lib/avisosContexto.js';

const KINDS = [
  ['contrato', 'Contratos'],
  ['termo', 'Termos'],
];

const novoVazio = () => ({ name: '', kind: 'termo', method: 'autentique', body: '' });

export function Contract({ db, project, isStudio }) {
  const { ocultos } = useAvisos();
  const all = (db.contracts(project.id) || []).filter((c) => !ocultos.has(c.id));

  // Autentique sem depender do webhook: ao abrir a aba, consulta o status
  // real dos contratos "enviados" e marca como assinado quando for o caso.
  useEffect(() => {
    all
      .filter((c) => c.sigStatus === 'enviado' && c.providerDocId)
      .forEach((c) => {
        Promise.resolve(db.checkAutentique(project.id, c.id)).catch(() => {});
      });
    // roda uma vez por abertura da aba
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const clientName = db.clientName(project.id);
  const [kind, setKind] = useState('');
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState(novoVazio);
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [salvandoDoc, setSalvandoDoc] = useState(false);
  const [avisoArquivo, setAvisoArquivo] = useState('');
  const shown = kind ? all.filter((d) => d.kind === kind) : all;

  const metodoNovo = nf.kind === 'termo' ? 'aceite' : nf.method;
  // Autentique precisa do PDF; termo precisa de texto ou PDF; portal, de um dos dois
  const faltando =
    !nf.name.trim()
      ? 'nome'
      : metodoNovo === 'autentique' && !file
        ? 'pdf'
        : metodoNovo !== 'autentique' && !file && !nf.body.trim()
          ? 'conteudo'
          : null;

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Contratos e Termos</h2>
        {isStudio && (
          <button className="btn btn-ghost btn-sm" onClick={() => setAdding(!adding)}>
            <Plus size={14} /> Novo documento
          </button>
        )}
      </header>

      {adding && (
        <div className="add-stage">
          <div className="add-row">
            <input
              placeholder="Nome do documento"
              aria-label="Nome do documento"
              value={nf.name}
              onChange={(e) => setNf({ ...nf, name: e.target.value })}
            />
            <select aria-label="Tipo" value={nf.kind} onChange={(e) => setNf({ ...nf, kind: e.target.value })}>
              <option value="contrato">Contrato</option>
              <option value="termo">Termo</option>
            </select>
          </div>
          {nf.kind === 'contrato' ? (
            <label className="lab">
              Como o cliente assina
              <select value={nf.method} onChange={(e) => setNf({ ...nf, method: e.target.value })}>
                <option value="autentique">Autentique (validade jurídica — contrato oficial)</option>
                <option value="portal">Dentro do portal (nome digitado)</option>
              </select>
            </label>
          ) : (
            <p className="hint">Termos são resolvidos com um botão: o cliente aprova ou recusa.</p>
          )}
          {metodoNovo !== 'autentique' && (
            <label className="lab full">
              Texto do {nf.kind === 'termo' ? 'termo' : 'contrato'}
              <textarea
                rows={5}
                value={nf.body}
                onChange={(e) => setNf({ ...nf, body: e.target.value })}
                placeholder="Escreva aqui o que o cliente vai ler. Se preferir, anexe um PDF."
              />
            </label>
          )}
          <label className="lab">
            {metodoNovo === 'autentique' ? 'PDF do contrato' : 'PDF (opcional)'}
            <input
              key={fileKey}
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const f = e.target.files && e.target.files[0];
                const problema = f ? validarArquivo(f, { somentePdf: true }) : null;
                setAvisoArquivo(problema || '');
                setFile(problema ? null : f || null);
              }}
            />
          </label>
          {avisoArquivo && <p className="micro aviso-upload">{avisoArquivo}</p>}
          {faltando === 'pdf' && <p className="hint">Para a Autentique, anexe o PDF do contrato.</p>}
          {faltando === 'conteudo' && <p className="hint">Escreva o texto ou anexe um PDF.</p>}
          <div className="row">
            <button
              className="btn btn-primary btn-sm"
              disabled={!!faltando || salvandoDoc}
              onClick={async () => {
                setSalvandoDoc(true);
                try {
                  await db.addContractDoc(
                    project.id,
                    { name: nf.name.trim(), kind: nf.kind, method: metodoNovo, body: nf.body.trim() },
                    file,
                  );
                  setNf(novoVazio());
                  setFile(null);
                  setAvisoArquivo('');
                  setFileKey((k) => k + 1);
                  setAdding(false);
                } finally {
                  setSalvandoDoc(false);
                }
              }}
            >
              {salvandoDoc ? 'Adicionando…' : 'Adicionar'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="filter-row">
        {KINDS.map(([id, label]) => (
          <button
            key={id}
            className={'filter' + (kind === id ? ' on' : '')}
            onClick={() => setKind(kind === id ? '' : id)}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Empty text="Nenhum documento por aqui ainda." />
      ) : (
        shown.map((c) => <ContractDoc key={c.id} db={db} c={c} isStudio={isStudio} clientName={clientName} project={project} />)
      )}
    </section>
  );
}

function situacao(c) {
  const m = metodoDe(c);
  const quando = (d) => (d ? ' em ' + fmt(String(d).slice(0, 10)) : '');
  if (c.sigStatus === 'assinado')
    return m === 'aceite'
      ? 'Aprovado por ' + c.signer + quando(c.signedAt)
      : 'Assinado por ' + c.signer + quando(c.signedAt) + ' · via ' + (c.provider || 'Portal');
  if (c.sigStatus === 'recusado') return 'Recusado pelo cliente' + quando(c.respondedAt);
  if (c.sigStatus === 'enviado')
    return m === 'aceite'
      ? 'Aguardando aprovação do cliente'
      : m === 'portal'
        ? 'Aguardando assinatura do cliente no portal'
        : 'Enviado para assinatura · via ' + (c.provider || 'Autentique');
  return m === 'autentique' ? 'Aguardando envio para assinatura' : 'Ainda não liberado para o cliente';
}

function ContractDoc({ db, c, isStudio, clientName, project }) {
  const { avisar, excluirComDesfazer } = useAvisos();
  const metodo = metodoDe(c);
  const [provider, setProvider] = useState(c.provider || SIG_PROVIDERS[0]);
  const [redir, setRedir] = useState(false);
  const [sending, setSending] = useState(false);
  const [assinando, setAssinando] = useState(false);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState(false);
  const signed = c.sigStatus === 'assinado';
  const recusado = c.sigStatus === 'recusado';
  // comprovante em PDF do que foi aprovado/assinado dentro do portal (a
  // Autentique tem o próprio certificado)
  const temComprovante = signed && metodo !== 'autentique';
  const [gerando, setGerando] = useState(false);
  const baixarComprovante = async () => {
    setErro('');
    setGerando(true);
    try {
      const { gerarComprovantePdf, baixarBlob, nomeArquivo } = await import('../../lib/comprovante.js');
      const bytes = await gerarComprovantePdf({ contrato: c, projeto: project, cliente: clientName });
      baixarBlob(bytes, 'Comprovante-' + nomeArquivo(c.name) + '.pdf', 'application/pdf');
    } catch {
      setErro('Não foi possível gerar o comprovante. Tente de novo.');
    } finally {
      setGerando(false);
    }
  };
  if (editando) return <EditarContrato db={db} c={c} onFechar={() => setEditando(false)} />;

  const responder = async (acao, nome, mot) => {
    setErro('');
    setOcupado(true);
    try {
      await db.responderContrato(c.id, acao, nome, mot);
      avisar(acao === 'recusar' ? 'Recusa enviada ao studio' : acao === 'assinar' ? 'Documento assinado' : 'Documento aprovado');
      setRecusando(false);
      setAssinando(false);
    } catch (e) {
      setErro(erroAmigavel(e).texto);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div
      className={'contract-block contract-' + (signed ? 'signed' : recusado ? 'recusado' : 'pending')}
      id={'alvo-contrato-' + c.id}
    >
      <div className={'contract ' + (signed ? 'signed' : recusado ? 'recusado' : 'pending')}>
        <span className="contract-ic">{signed ? <ShieldCheck size={20} /> : <PenLine size={20} />}</span>
        <div className="contract-meta">
          <strong>{c.name}</strong>
          <span className="sig-line">
            {(c.kind === 'termo' ? 'Termo' : 'Contrato') + ' · '}
            {situacao(c)}
          </span>
        </div>
      </div>

      {c.body && (isStudio || c.sigStatus !== 'rascunho') && <div className="contract-body">{c.body}</div>}
      {recusado && c.responseNote && (
        <p className="contract-motivo">
          <strong>Motivo da recusa:</strong> {c.responseNote}
        </p>
      )}

      {(c.storagePath || isStudio || temComprovante) && (
        <div className="row contract-actions">
          {temComprovante && (
            <button type="button" className="btn btn-ghost btn-sm" disabled={gerando} onClick={baixarComprovante}>
              <Download size={12} /> {gerando ? 'Gerando…' : 'Baixar comprovante (PDF)'}
            </button>
          )}
          {IS_SUPABASE && isStudio && metodo === 'autentique' && c.sigStatus === 'enviado' && c.studioSignLink && (
            <a className="btn btn-ghost btn-sm" href={c.studioSignLink} target="_blank" rel="noreferrer">
              <Send size={12} /> Assinar como studio
            </a>
          )}
          {c.storagePath && (
            <button
              type="button"
              className="link sm"
              onClick={async () => {
                const url = await db.fileUrl(c.storagePath);
                if (url) window.open(url, '_blank');
              }}
            >
              <FileText size={12} /> Ver PDF
            </button>
          )}
          {IS_SUPABASE && isStudio && metodo === 'autentique' && c.sigStatus === 'rascunho' && c.storagePath && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={sending}
              onClick={async () => {
                if (
                  !window.confirm(
                    'Enviar "' +
                      c.name +
                      '" para assinatura na Autentique? Você será direcionado para assinar, e o cliente recebe o e-mail para a assinatura dele. O status vira "assinado" quando os dois assinarem.',
                  )
                )
                  return;
                setSending(true);
                try {
                  const res = await db.sendToAutentique(c.projectId, c.id);
                  if (res && res.studioSignLink) window.open(res.studioSignLink, '_blank', 'noopener');
                } finally {
                  setSending(false);
                }
              }}
            >
              <Send size={12} /> {sending ? 'Enviando…' : 'Enviar p/ assinatura'}
            </button>
          )}
          {isStudio && metodo !== 'autentique' && c.sigStatus === 'rascunho' && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => db.setContract(c.id, { sigStatus: 'enviado', provider: 'Portal' })}
            >
              <Send size={12} /> Liberar para o cliente
            </button>
          )}
          {isStudio && recusado && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => db.setContract(c.id, { sigStatus: 'enviado', responseNote: null, respondedAt: null })}
            >
              <RotateCcw size={12} /> Liberar novamente
            </button>
          )}
          {isStudio && !signed && (
            <button type="button" className="link sm" onClick={() => setEditando(true)}>
              <Pencil size={12} /> Editar
            </button>
          )}
          {isStudio && (
            <button
              type="button"
              className="link sm danger"
              onClick={() =>
                excluirComDesfazer({ id: c.id, texto: '"' + c.name + '" excluído', executar: () => db.deleteContractDoc(c.projectId, c.id) })
              }
            >
              <Trash2 size={12} /> Excluir
            </button>
          )}
        </div>
      )}

      {/* ---- modo demonstração: simulação da plataforma externa ---- */}
      {!IS_SUPABASE && isStudio && metodo === 'autentique' && c.sigStatus === 'rascunho' && (
        <div className="sign-box">
          <p className="sign-doc">
            Selecione a plataforma e envie para assinatura. Com a integração da Autentique ativa, o documento vai por
            e-mail para você e para o cliente.
          </p>
          <select className="sign-input" value={provider} onChange={(e) => setProvider(e.target.value)}>
            {SIG_PROVIDERS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <div className="row">
            <button className="btn btn-primary btn-sm" onClick={() => db.setContract(c.id, { sigStatus: 'enviado', provider })}>
              Enviar para assinatura
            </button>
          </div>
        </div>
      )}
      {isStudio && metodo === 'autentique' && c.sigStatus === 'enviado' && (
        <div className="row">
          <p className="hint">Aguardando assinaturas na {c.provider}.</p>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() =>
              db.setContract(c.id, {
                sigStatus: 'assinado',
                signer: clientName,
                signedAt: todayISO(),
              })
            }
          >
            Marcar assinado manualmente
          </button>
        </div>
      )}

      {/* ---- cliente: Autentique ---- */}
      {!isStudio && metodo === 'autentique' && c.sigStatus === 'enviado' && IS_SUPABASE && (
        <p className="hint">O link para assinar chegou no seu e-mail, enviado pela Autentique.</p>
      )}
      {!isStudio && metodo === 'autentique' && c.sigStatus === 'enviado' && !IS_SUPABASE && !redir && (
        <button className="btn btn-primary btn-sm" onClick={() => setRedir(true)}>
          Assinar agora
        </button>
      )}
      {!isStudio && metodo === 'autentique' && !IS_SUPABASE && redir && c.sigStatus === 'enviado' && (
        <div className="sign-box">
          <p className="sign-doc">
            Você será redirecionado para a <strong>{c.provider}</strong> para assinar com validade jurídica. No modo de
            demonstração, simulamos a conclusão.
          </p>
          <div className="row">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                db.setContract(c.id, { sigStatus: 'assinado', signer: clientName, signedAt: todayISO() });
                setRedir(false);
              }}
            >
              Concluir assinatura
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setRedir(false)}>
              Voltar
            </button>
          </div>
        </div>
      )}

      {/* ---- cliente: termo (aprovar ou recusar) ---- */}
      {!isStudio && metodo === 'aceite' && c.sigStatus === 'enviado' && !recusando && (
        <div className="row">
          <button type="button" className="btn btn-primary btn-sm" disabled={ocupado} onClick={() => responder('aprovar')}>
            <Check size={13} /> {ocupado ? 'Enviando…' : 'Aprovar'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={ocupado} onClick={() => setRecusando(true)}>
            <X size={13} /> Recusar
          </button>
        </div>
      )}
      {!isStudio && metodo === 'aceite' && c.sigStatus === 'enviado' && recusando && (
        <div className="sign-box">
          <label className="lab">
            Conte ao studio o motivo (opcional)
            <textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </label>
          <div className="row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={ocupado}
              onClick={() => responder('recusar', null, motivo)}
            >
              {ocupado ? 'Enviando…' : 'Confirmar recusa'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRecusando(false)}>
              Voltar
            </button>
          </div>
        </div>
      )}

      {/* ---- cliente: assinatura dentro do portal ---- */}
      {!isStudio &&
        metodo === 'portal' &&
        c.sigStatus === 'enviado' &&
        (assinando ? (
          <AssinaturaPortal
            titulo={c.name}
            onAssinar={async (nome) => {
              await db.responderContrato(c.id, 'assinar', nome);
              setAssinando(false);
            }}
            onCancelar={() => setAssinando(false)}
          />
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setAssinando(true)}>
            <PenLine size={13} /> Assinar
          </button>
        ))}

      {erro && (
        <p className="error" role="alert">
          {erro}
        </p>
      )}
      {!isStudio && recusado && <p className="hint">Você recusou este documento. O studio vai revisar e falar com você.</p>}
      {!isStudio && c.sigStatus === 'rascunho' && (
        <p className="hint">Este documento ainda não foi liberado pelo studio.</p>
      )}
    </div>
  );
}

/* Editar termo ou contrato (studio): nome, texto e o PDF. Não vale para
   documento já assinado ou aprovado. */
function EditarContrato({ db, c, onFechar }) {
  const [nome, setNome] = useState(c.name || '');
  const [texto, setTexto] = useState(c.body || '');
  const [arquivo, setArquivo] = useState(null);
  const [aviso, setAviso] = useState('');
  const [salvando, setSalvando] = useState(false);
  const comTexto = metodoDe(c) !== 'autentique' || !!c.body;
  const salvar = async () => {
    if (!nome.trim() || salvando) return;
    setSalvando(true);
    try {
      await db.updateContractDoc(c.projectId, c.id, { name: nome.trim(), body: texto }, arquivo);
      onFechar();
    } catch {
      setSalvando(false);
    }
  };
  return (
    <div className="contract-block contract-editando" id={'alvo-contrato-' + c.id}>
      <label className="lab">
        Nome do documento
        <input value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome do documento" />
      </label>
      {comTexto && (
        <label className="lab">
          Texto
          <textarea rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Texto do documento" />
        </label>
      )}
      <label className="lab">
        {c.storagePath ? 'Trocar o PDF (opcional)' : 'Anexar PDF (opcional)'}
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => {
            const f = e.target.files && e.target.files[0];
            const problema = f ? validarArquivo(f, { somentePdf: true }) : null;
            setAviso(problema || '');
            setArquivo(problema ? null : f || null);
          }}
        />
      </label>
      {aviso && <p className="micro aviso-upload">{aviso}</p>}
      {c.sigStatus === 'enviado' && (
        <p className="hint">Este documento já está com o cliente. Ele passa a ver a versão editada.</p>
      )}
      <div className="row">
        <button type="button" className="btn btn-primary btn-sm" disabled={!nome.trim() || salvando} onClick={salvar}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onFechar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
