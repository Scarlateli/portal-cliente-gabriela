import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { STAGE_CATEGORIES } from '../../lib/constants.js';
import { SUB_TIPOS, SUB_RESPONSAVEIS, etapaVazia, subVazia } from '../../lib/etapas.js';

/* Editor de etapas com sub-etapas, usado em dois lugares: no cadastro de
   templates (criar e editar) e no formulário de novo projeto, para ajustar o
   template antes de enviar o acesso ao cliente. */

export function EtapasEditor({ itens, onChange }) {
  const mudarEtapa = (i, campo, valor) =>
    onChange(itens.map((it, k) => (k === i ? { ...it, [campo]: valor } : it)));
  const mover = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= itens.length) return;
    const novo = itens.slice();
    [novo[i], novo[j]] = [novo[j], novo[i]];
    onChange(novo);
  };
  const mudarSub = (i, b, campo, valor) =>
    mudarEtapa(
      i,
      'subs',
      (itens[i].subs || []).map((s, k) => (k === b ? { ...s, [campo]: valor } : s)),
    );

  return (
    <div className="ee">
      {itens.length === 0 && <p className="hint">Nenhuma etapa ainda.</p>}
      {itens.map((it, i) => (
        <div className="ee-etapa" key={i}>
          <div className="ee-linha">
            <input
              placeholder={'Etapa ' + (i + 1)}
              aria-label={'Título da etapa ' + (i + 1)}
              value={it.title}
              onChange={(e) => mudarEtapa(i, 'title', e.target.value)}
            />
            <select
              aria-label={'Categoria da etapa ' + (i + 1)}
              value={it.category}
              onChange={(e) => mudarEtapa(i, 'category', e.target.value)}
            >
              {STAGE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <span className="ee-botoes">
              <button type="button" className="icon-btn" aria-label="Subir etapa" disabled={i === 0} onClick={() => mover(i, -1)}>
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Descer etapa"
                disabled={i === itens.length - 1}
                onClick={() => mover(i, 1)}
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={'Remover etapa ' + (i + 1)}
                onClick={() => onChange(itens.filter((_, k) => k !== i))}
              >
                <X size={14} />
              </button>
            </span>
          </div>

          {(it.subs || []).length > 0 && (
            <ul className="ee-subs">
              {it.subs.map((b, k) => (
                <li className="ee-sub" key={k}>
                  <input
                    placeholder="Sub-etapa"
                    aria-label={'Título da sub-etapa ' + (k + 1) + ' da etapa ' + (i + 1)}
                    value={b.title}
                    onChange={(e) => mudarSub(i, k, 'title', e.target.value)}
                  />
                  <select aria-label="Tipo da sub-etapa" value={b.kind} onChange={(e) => mudarSub(i, k, 'kind', e.target.value)}>
                    {SUB_TIPOS.map(([v, r]) => (
                      <option key={v} value={v}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Responsável pela sub-etapa"
                    value={b.responsible}
                    onChange={(e) => mudarSub(i, k, 'responsible', e.target.value)}
                  >
                    {SUB_RESPONSAVEIS.map(([v, r]) => (
                      <option key={v} value={v}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Remover sub-etapa"
                    onClick={() => mudarEtapa(i, 'subs', it.subs.filter((_, j) => j !== k))}
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="link sm ee-add-sub" onClick={() => mudarEtapa(i, 'subs', [...(it.subs || []), subVazia()])}>
            <Plus size={12} /> Sub-etapa
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([...itens, etapaVazia()])}>
        <Plus size={14} /> Adicionar etapa
      </button>
    </div>
  );
}
