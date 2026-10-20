import { useState } from 'react';
import { BadgeCheck, MessageSquareWarning, Send, X } from 'lucide-react';
import { erroAmigavel } from '../../lib/erros.js';
import { IS_SUPABASE } from '../../lib/data.js';

/* Aprovação de etapa pelo portal (rodada 4): ao fim de uma etapa, o studio
   pede a aprovação; o cliente aprova (com o nome completo, que fica
   registrado com a data) ou pede ajustes (com a mensagem). Sem contrato.
   No banco: stages.approval e a função responder_etapa. */

const dataBR = (iso) => (iso ? String(iso).slice(8, 10) + '/' + String(iso).slice(5, 7) + '/' + String(iso).slice(0, 4) : '');

export function AprovacaoEtapa({ db, s, isStudio, projectId }) {
  return isStudio ? <LadoStudio db={db} s={s} projectId={projectId} /> : <LadoCliente db={db} s={s} />;
}

function LadoStudio({ db, s, projectId }) {
  const [pedindo, setPedindo] = useState(false);
  const [avisar, setAvisar] = useState(IS_SUPABASE);
  const [aviso, setAviso] = useState('');
  const a = s.approval || 'nenhuma';

  const pedir = async () => {
    setPedindo(false);
    await db.pedirAprovacaoEtapa(s.id, true);
    if (avisar) {
      try {
        const r = await db.avisarCliente(projectId, 'Aprovar a etapa "' + s.title + '"');
        setAviso(r && r.emailSent ? 'Cliente avisado por e-mail.' : 'Pedido feito. O e-mail não foi enviado.');
      } catch {
        setAviso('Pedido feito. O e-mail não foi enviado.');
      }
    }
  };

  if (pedindo)
    return (
      <div className="aprov aprov-pedir">
        <p>
          O cliente vai ver um pedido para <strong>aprovar a etapa “{s.title}”</strong> no portal, com a opção de pedir
          ajustes.
        </p>
        {IS_SUPABASE && (
          <label className="aprov-check">
            <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} /> Avisar o cliente
            por e-mail
          </label>
        )}
        <div className="row">
          <button type="button" className="btn btn-primary btn-sm" onClick={pedir}>
            <Send size={13} /> Pedir aprovação
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPedindo(false)}>
            Cancelar
          </button>
        </div>
      </div>
    );

  if (a === 'nenhuma')
    return (
      <div className="aprov aprov-vazio">
        <button type="button" className="link sm" onClick={() => setPedindo(true)}>
          <BadgeCheck size={13} /> Pedir aprovação do cliente
        </button>
      </div>
    );

  return (
    <div className={'aprov aprov-' + a}>
      {a === 'pendente' && (
        <p>
          <BadgeCheck size={14} /> Aguardando a aprovação do cliente
          {s.approvalRequestedAt ? ' (pedida em ' + dataBR(s.approvalRequestedAt) + ')' : ''}.
        </p>
      )}
      {a === 'aprovada' && (
        <p>
          <BadgeCheck size={14} /> Aprovada por <strong>{s.approvalName}</strong> em {dataBR(s.approvalAt)}.
          {s.approvalNote ? ' Comentário: “' + s.approvalNote + '”' : ''}
        </p>
      )}
      {a === 'ajustes' && (
        <p>
          <MessageSquareWarning size={14} /> O cliente pediu ajustes em {dataBR(s.approvalAt)}: “{s.approvalNote}”
        </p>
      )}
      <div className="aprov-acoes">
        {a === 'pendente' ? (
          <button type="button" className="link sm" onClick={() => db.pedirAprovacaoEtapa(s.id, false)}>
            <X size={12} /> Cancelar pedido
          </button>
        ) : (
          <button type="button" className="link sm" onClick={() => setPedindo(true)}>
            <Send size={12} /> Pedir aprovação de novo
          </button>
        )}
        {aviso && <span className="micro">{aviso}</span>}
      </div>
    </div>
  );
}

function LadoCliente({ db, s }) {
  const [modo, setModo] = useState(null); // 'aprovar' | 'ajustes' | null
  const [nome, setNome] = useState('');
  const [li, setLi] = useState(false);
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const a = s.approval || 'nenhuma';
  if (a === 'nenhuma') return null;

  if (a === 'aprovada')
    return (
      <div className="aprov aprov-aprovada">
        <p>
          <BadgeCheck size={14} /> Você aprovou esta etapa em {dataBR(s.approvalAt)}.
        </p>
      </div>
    );
  if (a === 'ajustes')
    return (
      <div className="aprov aprov-ajustes">
        <p>
          <MessageSquareWarning size={14} /> Você pediu ajustes em {dataBR(s.approvalAt)}. O studio vai retornar.
        </p>
      </div>
    );

  const responder = async (decisao) => {
    setErro('');
    setEnviando(true);
    try {
      await db.responderEtapa(s.id, decisao, decisao === 'aprovar' ? nome.trim() : null, msg.trim() || null);
      setModo(null);
    } catch (e) {
      setErro(erroAmigavel(e).texto);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="aprov aprov-pendente aprov-cliente">
      <p className="aprov-titulo">
        <BadgeCheck size={15} /> O studio pede a sua aprovação desta etapa
      </p>
      {!modo && (
        <div className="row">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setModo('aprovar')}>
            Aprovar etapa
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModo('ajustes')}>
            Pedir ajustes
          </button>
        </div>
      )}
      {modo === 'aprovar' && (
        <div className="aprov-form">
          <label className="lab">
            Seu nome completo
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" aria-label="Nome completo para aprovar" />
          </label>
          <label className="aprov-check">
            <input type="checkbox" checked={li} onChange={(e) => setLi(e.target.checked)} /> Revisei e aprovo a etapa
            “{s.title}”. Ficam registrados o meu nome, a data e o horário.
          </label>
          <div className="row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={nome.trim().length < 3 || !li || enviando}
              onClick={() => responder('aprovar')}
            >
              {enviando ? 'Enviando…' : 'Confirmar aprovação'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModo(null)}>
              Voltar
            </button>
          </div>
        </div>
      )}
      {modo === 'ajustes' && (
        <div className="aprov-form">
          <label className="lab">
            O que precisa ser ajustado?
            <textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} aria-label="O que precisa ser ajustado" />
          </label>
          <div className="row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!msg.trim() || enviando}
              onClick={() => responder('ajustes')}
            >
              {enviando ? 'Enviando…' : 'Enviar pedido de ajustes'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModo(null)}>
              Voltar
            </button>
          </div>
        </div>
      )}
      {erro && <p className="error">{erro}</p>}
    </div>
  );
}
