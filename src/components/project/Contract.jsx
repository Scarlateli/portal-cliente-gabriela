import { useState } from 'react';
import { IS_SUPABASE } from '../../lib/data.js';
import {
  ShieldCheck,
  PenLine,
  Plus,
  FileText,
  Trash2,
  Send,
} from 'lucide-react';
import { Empty } from '../atoms.jsx';
import { SIG_PROVIDERS } from '../../lib/constants.js';
import { fmt, todayISO } from '../../lib/helpers.js';

const KINDS = [
  ['contrato', 'Contratos'],
  ['termo', 'Termos'],
];

export function Contract({ db, project, isStudio }) {
  const all = db.contracts(project.id) || [];
  const clientName = db.clientName(project.id);
  const [kind, setKind] = useState('');
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState({ name: '', kind: 'termo' });
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const shown = kind ? all.filter((d) => d.kind === kind) : all;
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Contratos e termos</h2>
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
              placeholder="Nome do documento (ex.: Termo de autorização de imagens)"
              value={nf.name}
              onChange={(e) => setNf({ ...nf, name: e.target.value })}
            />
            <select value={nf.kind} onChange={(e) => setNf({ ...nf, kind: e.target.value })}>
              <option value="contrato">Contrato</option>
              <option value="termo">Termo</option>
            </select>
            <input key={fileKey} type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
          </div>
          <div className="row">
            <button
              className="btn btn-primary btn-sm"
              disabled={!nf.name.trim()}
              onClick={() => {
                db.addContractDoc(project.id, { name: nf.name.trim(), kind: nf.kind }, file);
                setNf({ name: '', kind: 'termo' });
                setFile(null);
                setFileKey((k) => k + 1);
                setAdding(false);
              }}
            >
              Adicionar
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
            {label} ({all.filter((d) => d.kind === id).length})
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Empty text="Nenhum documento por aqui ainda." />
      ) : (
        shown.map((c) => (
          <ContractDoc key={c.id} db={db} c={c} isStudio={isStudio} clientName={clientName} />
        ))
      )}
    </section>
  );
}

function ContractDoc({ db, c, isStudio, clientName }) {
  const [provider, setProvider] = useState(c.provider || SIG_PROVIDERS[0]);
  const [redir, setRedir] = useState(false);
  const [sending, setSending] = useState(false);
  const signed = c.sigStatus === 'assinado';
  return (
    <div className="contract-block">
      <div className={'contract ' + (signed ? 'signed' : 'pending')}>
        <span className="contract-ic">
          {signed ? <ShieldCheck size={20} /> : <PenLine size={20} />}
        </span>
        <div className="contract-meta">
          <strong>{c.name}</strong>
          <span className="sig-line">
            {(c.kind === 'termo' ? 'Termo' : 'Contrato') + ' · '}
            {signed
              ? 'Assinado por ' + c.signer + ' em ' + fmt(c.signedAt) + ' · via ' + c.provider
              : c.sigStatus === 'enviado'
                ? 'Enviado para assinatura · via ' + c.provider
                : 'Aguardando envio para assinatura'}
          </span>
        </div>
      </div>

      {(c.storagePath || isStudio) && (
        <div className="row contract-actions">
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
          {IS_SUPABASE && isStudio && c.sigStatus === 'rascunho' && c.storagePath && (
            <button
              type="button"
              className="link sm"
              disabled={sending}
              onClick={async () => {
                if (
                  !window.confirm(
                    'Enviar "' + c.name + '" para assinatura na Autentique? O cliente recebe o e-mail de assinatura deles.',
                  )
                )
                  return;
                setSending(true);
                try {
                  await db.sendToAutentique(c.projectId, c.id);
                } finally {
                  setSending(false);
                }
              }}
            >
              <Send size={12} /> {sending ? 'Enviando…' : 'Enviar p/ assinatura'}
            </button>
          )}
          {isStudio && (
            <button
              type="button"
              className="link sm danger"
              onClick={() => {
                if (window.confirm('Excluir "' + c.name + '"? O PDF anexado também será removido.'))
                  db.deleteContractDoc(c.projectId, c.id);
              }}
            >
              <Trash2 size={12} /> Excluir
            </button>
          )}
        </div>
      )}

      {isStudio && c.sigStatus === 'rascunho' && (
        <div className="sign-box">
          <p className="sign-doc">
            Selecione a plataforma e envie para assinatura. Com a integração da Autentique ativa, o
            documento vai por e-mail para você e para o cliente.
          </p>
          <select
            className="sign-input"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            {SIG_PROVIDERS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <div className="row">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => db.setContract(c.id, { sigStatus: 'enviado', provider })}
            >
              Enviar para assinatura
            </button>
          </div>
        </div>
      )}
      {isStudio && c.sigStatus === 'enviado' && (
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
            Simular assinatura concluída
          </button>
        </div>
      )}

      {!isStudio && c.sigStatus === 'enviado' && !redir && (
        <button className="btn btn-primary btn-sm" onClick={() => setRedir(true)}>
          Assinar agora
        </button>
      )}
      {!isStudio && redir && c.sigStatus === 'enviado' && (
        <div className="sign-box">
          <p className="sign-doc">
            Você será redirecionado para a <strong>{c.provider}</strong> para assinar com validade
            jurídica. Enquanto a integração não está ativa, simulamos a conclusão.
          </p>
          <div className="row">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                db.setContract(c.id, {
                  sigStatus: 'assinado',
                  signer: clientName,
                  signedAt: todayISO(),
                });
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
      {!isStudio && c.sigStatus === 'rascunho' && (
        <p className="hint">Este documento ainda não foi liberado pelo studio para assinatura.</p>
      )}
    </div>
  );
}
