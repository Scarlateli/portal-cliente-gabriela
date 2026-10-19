import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { STAGE_CATEGORIES } from '../../lib/constants.js';
import { SUB_TIPOS, SUB_RESPONSAVEIS, etapaVazia, subVazia, moverNaLista } from '../../lib/etapas.js';

/* Editor de etapas com sub-etapas, usado em dois lugares: no cadastro de
   templates (criar e editar) e no formulário de novo projeto, para ajustar o
   template antes de enviar o acesso ao cliente. Etapas e sub-etapas sobem e
   descem com as setas, sem precisar apagar e criar de novo. */

function Setas({ rotulo, i, total, onMover, onRemover, tamanho = 14 }) {
  return (
    <span className="ee-botoes">
      <button type="button" className="icon-btn" aria-label={'Subir ' + rotulo} disabled={i === 0} onClick={() => onMover(-1)}>
        <ArrowUp size={tamanho} />
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label={'Descer ' + rotulo}
        disabled={i === total - 1}
        onClick={() => onMover(1)}
      >
        <ArrowDown size={tamanho} />
      </button>
      <button type="button" className="icon-btn" aria-label={'Remover ' + rotulo} onClick={onRemover}>
        <X size={tamanho} />
      </button>
    </span>
  );
}

export function EtapasEditor({ itens, onChange }) {
  const mudarEtapa = (i, campo, valor) =>
    onChange(itens.map((it, k) => (k === i ? { ...it, [campo]: valor } : it)));
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
              placeholder={'Etapa ' + (i + 1) + ' (ex.: Briefing)'}
              aria-label={'Título da etapa ' + (i + 1)}
              value={it.title}
              onChange={(e) => mudarEtapa(i, 'title', e.target.value)}
            />
            <select
              aria-label={'Tipo da etapa ' + (i + 1)}
              value={it.category}
              onChange={(e) => mudarEtapa(i, 'category', e.target.value)}
            >
              {/* etapas antigas podem ter um tipo fora da lista: continua aparecendo */}
              {!STAGE_CATEGORIES.includes(it.category) && it.category && <option>{it.category}</option>}
              {STAGE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <Setas
              rotulo={'etapa ' + (i + 1)}
              i={i}
              total={itens.length}
              onMover={(d) => onChange(moverNaLista(itens, i, d))}
              onRemover={() => onChange(itens.filter((_, k) => k !== i))}
            />
          </div>

          {(it.subs || []).length > 0 && (
            <ul className="ee-subs">
              {it.subs.map((b, k) => (
                <li className="ee-sub" key={k}>
                  <input
                    className="ee-sub-titulo"
                    placeholder="Sub-etapa (ex.: Reunião de briefing)"
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
                  <Setas
                    rotulo={'sub-etapa ' + (k + 1)}
                    i={k}
                    total={it.subs.length}
                    tamanho={13}
                    onMover={(d) => mudarEtapa(i, 'subs', moverNaLista(it.subs, k, d))}
                    onRemover={() => mudarEtapa(i, 'subs', it.subs.filter((_, j) => j !== k))}
                  />
                  {b.kind === 'outro' && (
                    <input
                      className="ee-sub-tipo-livre"
                      placeholder="Nome do tipo (ex.: Aprovação de condomínio)"
                      aria-label="Nome do tipo da sub-etapa"
                      maxLength={40}
                      value={b.kindLabel || ''}
                      onChange={(e) => mudarSub(i, k, 'kindLabel', e.target.value)}
                    />
                  )}
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
