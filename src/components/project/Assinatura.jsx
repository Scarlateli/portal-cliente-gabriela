import { useState } from 'react';
import { PenLine } from 'lucide-react';
import { erroAmigavel } from '../../lib/erros.js';

/* Assinatura dentro do portal: o cliente digita o nome completo e confirma
   que leu. Fica registrado quem assinou, quando e com que nome. Serve para
   documentos e para contratos em que a Gabriela escolheu o portal; o
   contrato oficial do projeto segue pela Autentique. */
export function AssinaturaPortal({ titulo, onAssinar, onCancelar }) {
  const [nome, setNome] = useState('');
  const [li, setLi] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const pronto = nome.trim().length >= 3 && li && !enviando;

  const assinar = async () => {
    if (!pronto) return;
    setErro('');
    setEnviando(true);
    try {
      await onAssinar(nome.trim());
    } catch (e) {
      setErro(erroAmigavel(e).texto);
      setEnviando(false);
    }
  };

  return (
    <div className="sign-box assinatura">
      <p className="sign-doc">
        Para assinar <strong>{titulo}</strong>, digite o seu nome completo. Ficam registrados o nome, a data e o horário.
      </p>
      <input
        className="sign-input"
        placeholder="Nome completo"
        aria-label="Nome completo para a assinatura"
        autoComplete="name"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <label className="assinatura-li">
        <input type="checkbox" checked={li} onChange={(e) => setLi(e.target.checked)} /> Li o documento e concordo com o
        conteúdo.
      </label>
      {erro && (
        <p className="error" role="alert">
          {erro}
        </p>
      )}
      <div className="row">
        <button type="button" className="btn btn-primary btn-sm" disabled={!pronto} onClick={assinar}>
          <PenLine size={13} /> {enviando ? 'Assinando…' : 'Assinar'}
        </button>
        {onCancelar && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancelar}>
            Voltar
          </button>
        )}
      </div>
    </div>
  );
}
