import { useState } from 'react';
import { Check, CircleDot, ShieldCheck, PenLine } from 'lucide-react';
import { SIG_PROVIDERS } from '../../lib/constants.js';
import { fmt, todayISO } from '../../lib/helpers.js';

export function Contract({ db, project, isStudio }) {
  const c = db.contract(project.id);
  const [provider, setProvider] = useState(SIG_PROVIDERS[0]);
  const [redir, setRedir] = useState(false);
  if (!c) return null;
  const steps = [['rascunho', 'Rascunho'], ['enviado', 'Enviado para assinatura'], ['assinado', 'Assinado']];
  const idx = steps.findIndex((s) => s[0] === c.sigStatus);
  return (
    <section className="panel">
      <header className="panel-head"><h2>Contrato e assinatura</h2></header>

      <div className="sig-track">
        {steps.map((s, i) => (
          <div key={s[0]} className={'sig-step' + (i <= idx ? ' on' : '')}>
            <span className="sig-dot">{i < idx ? <Check size={12} /> : i === idx ? <CircleDot size={12} /> : i + 1}</span>
            <span>{s[1]}</span>
          </div>
        ))}
      </div>

      <div className={'contract ' + (c.sigStatus === 'assinado' ? 'signed' : 'pending')}>
        <span className="contract-ic">{c.sigStatus === 'assinado' ? <ShieldCheck size={20} /> : <PenLine size={20} />}</span>
        <div className="contract-meta">
          <strong>{c.name}</strong>
          {c.sigStatus === 'assinado' ? <small>Assinado por {c.signer} em {fmt(c.signedAt)} · via {c.provider}</small>
            : c.sigStatus === 'enviado' ? <small>Enviado para assinatura via {c.provider}</small>
            : <small>Ainda não enviado para assinatura</small>}
        </div>
      </div>

      {/* STUDIO */}
      {isStudio && c.sigStatus === 'rascunho' && (
        <div className="sign-box">
          <p className="sign-doc">Selecione a plataforma de assinatura e envie o contrato. No backend, isso dispara a API e o documento vai por e-mail para você e para o cliente.</p>
          <select className="sign-input" value={provider} onChange={(e) => setProvider(e.target.value)}>{SIG_PROVIDERS.map((p) => <option key={p}>{p}</option>)}</select>
          <div className="row"><button className="btn btn-primary" onClick={() => db.setContract(project.id, { sigStatus: 'enviado', provider })}>Enviar para assinatura</button></div>
        </div>
      )}
      {isStudio && c.sigStatus === 'enviado' && (
        <>
          <p className="hint">Aguardando assinaturas na {c.provider}. O status muda automaticamente quando todos assinarem (via webhook).</p>
          <button className="btn btn-ghost btn-sm" onClick={() => db.setContract(project.id, { sigStatus: 'assinado', signer: db.clientName(project.id), signedAt: todayISO() })}>Simular assinatura concluída</button>
        </>
      )}

      {/* CLIENTE */}
      {!isStudio && c.sigStatus === 'enviado' && !redir && (
        <button className="btn btn-primary" onClick={() => setRedir(true)}>Assinar agora</button>
      )}
      {!isStudio && redir && c.sigStatus === 'enviado' && (
        <div className="sign-box">
          <p className="sign-doc">Você seria redirecionado para a <strong>{c.provider}</strong> para assinar com validade jurídica. Aqui no protótipo, simulamos a conclusão.</p>
          <div className="row">
            <button className="btn btn-primary" onClick={() => { db.setContract(project.id, { sigStatus: 'assinado', signer: db.clientName(project.id), signedAt: todayISO() }); setRedir(false); }}>Concluir assinatura</button>
            <button className="btn btn-ghost" onClick={() => setRedir(false)}>Voltar</button>
          </div>
        </div>
      )}
      {!isStudio && c.sigStatus === 'rascunho' && <p className="hint">O contrato ainda não foi liberado pelo studio para assinatura.</p>}
    </section>
  );
}
