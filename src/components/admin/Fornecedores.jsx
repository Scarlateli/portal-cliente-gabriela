import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Empty } from '../atoms.jsx';
import { SEGMENTS } from '../../lib/constants.js';

/* Cadastro de fornecedores do studio (Etapa 8). Vale para todos os projetos:
   ao criar um orçamento, a Gabriela escolhe daqui e os dados vêm preenchidos. */
const vazio = () => ({ name: '', segment: SEGMENTS[0], contact: '', phone: '', email: '', notes: '' });

export function Fornecedores({ db }) {
  const lista = db.fornecedores() || [];
  const [f, setF] = useState(null); // formulário aberto (novo ou edição)
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const campo = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const salvar = async () => {
    if (!f.name.trim() || salvando) return;
    setSalvando(true);
    try {
      if (editando) await db.updateFornecedor(editando, f);
      else await db.addFornecedor(f);
      setF(null);
      setEditando(null);
    } catch {
      /* erro exibido pelo ErrorBanner do contêiner */
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Fornecedores</h2>
        {!f && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setEditando(null);
              setF(vazio());
            }}
          >
            <Plus size={14} /> Cadastrar fornecedor
          </button>
        )}
      </header>
      <p className="hint">Os fornecedores cadastrados aqui aparecem para escolha ao criar um orçamento, já com os dados preenchidos.</p>

      {f && (
        <div className="add-stage">
          <div className="form-grid">
            <label className="lab">
              Nome
              <input value={f.name} onChange={campo('name')} aria-label="Nome do fornecedor" />
            </label>
            <label className="lab">
              Segmento
              <select value={f.segment || ''} onChange={campo('segment')}>
                {SEGMENTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="lab">
              Pessoa de contato
              <input value={f.contact || ''} onChange={campo('contact')} aria-label="Pessoa de contato" />
            </label>
            <label className="lab">
              Telefone
              <input type="tel" value={f.phone || ''} onChange={campo('phone')} aria-label="Telefone do fornecedor" />
            </label>
            <label className="lab">
              E-mail
              <input type="email" value={f.email || ''} onChange={campo('email')} aria-label="E-mail do fornecedor" />
            </label>
            <label className="lab full">
              Observações
              <input value={f.notes || ''} onChange={campo('notes')} aria-label="Observações sobre o fornecedor" />
            </label>
          </div>
          <div className="row">
            <button className="btn btn-primary btn-sm" disabled={!f.name.trim() || salvando} onClick={salvar}>
              {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Cadastrar'}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setF(null);
                setEditando(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {lista.length === 0 ? (
        <Empty text="Nenhum fornecedor cadastrado ainda." />
      ) : (
        <ul className="forn-lista">
          {lista.map((x) => (
            <li key={x.id} className="forn">
              <div>
                <strong>{x.name}</strong>
                <small>{[x.segment, x.contact, x.phone, x.email].filter(Boolean).join(' · ')}</small>
                {x.notes && <small className="forn-obs">{x.notes}</small>}
              </div>
              <span className="tpl-acoes">
                <button
                  type="button"
                  className="link sm"
                  onClick={() => {
                    setEditando(x.id);
                    setF({ ...vazio(), ...x });
                  }}
                >
                  <Pencil size={12} /> Editar
                </button>
                <button
                  type="button"
                  className="link sm danger"
                  onClick={() => {
                    if (window.confirm('Remover "' + x.name + '" do cadastro? Os orçamentos já feitos com ele continuam.'))
                      db.deleteFornecedor(x.id);
                  }}
                >
                  <Trash2 size={12} /> Remover
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
