import { formatarCep } from '../../lib/endereco.js';

/* Campos do endereço do projeto, iguais no cadastro e na edição.
   Ficam dentro de um .form-grid (duas colunas). */
export function CamposEndereco({ f, setF }) {
  const campo = (k, tratar = (v) => v) => (e) => setF({ ...f, [k]: tratar(e.target.value) });
  return (
    <>
      <label className="lab">
        Rua e número
        <input value={f.address || ''} onChange={campo('address')} placeholder="Rua e número" aria-label="Rua e número" autoComplete="off" />
      </label>
      <label className="lab">
        Complemento
        <input value={f.addressComplement || ''} onChange={campo('addressComplement')} placeholder="Apto, bloco, casa" aria-label="Complemento" autoComplete="off" />
      </label>
      <label className="lab">
        Bairro
        <input value={f.neighborhood || ''} onChange={campo('neighborhood')} placeholder="Bairro" aria-label="Bairro" autoComplete="off" />
      </label>
      <label className="lab">
        CEP
        <input value={f.cep || ''} onChange={campo('cep', formatarCep)} placeholder="00000-000" inputMode="numeric" aria-label="CEP" autoComplete="off" />
      </label>
      <label className="lab">
        Cidade
        <input value={f.city || ''} onChange={campo('city')} placeholder="Cidade" aria-label="Cidade" autoComplete="off" />
      </label>
      <label className="lab lab-uf">
        Estado
        <input
          value={f.state || ''}
          onChange={campo('state', (v) => v.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
          placeholder="UF"
          aria-label="Estado (sigla)"
          autoComplete="off"
        />
      </label>
    </>
  );
}
