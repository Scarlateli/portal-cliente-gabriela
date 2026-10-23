import { useState, useEffect } from 'react';
import { AprovacaoEtapa } from './AprovacaoEtapa.jsx';
import {
  Plus,
  Clock,
  Video,
  MapPin,
  Calendar as CalendarIcon,
  CalendarDays,
  User,
  CalendarClock,
  Link2,
  AlertTriangle,
  ListChecks,
  Check,
  X,
  PenLine,
  Trash2,
  Save,
  ArrowUp,
  ArrowDown,
  FolderUp,
  ChevronDown,
  Flag,
  Play,
} from 'lucide-react';
import { StatusPill, Empty, MenuMais, StatusSelect } from '../atoms.jsx';
import { STAGE_STATUS, STAGE_CATEGORIES } from '../../lib/constants.js';
import { stageOverdue, subStats, fmt } from '../../lib/helpers.js';
import {
  SUB_TIPOS,
  SUB_RESPONSAVEIS,
  SUB_COM_HORARIO,
  ROTULO_RESP,
  rotuloTipoSub,
  prazoSub,
  quandoSub,
  subCompletaVazia,
} from '../../lib/etapas.js';
import { useAvisos } from '../../lib/avisosContexto.js';

const etapaNova = () => ({
  title: '',
  category: STAGE_CATEGORIES[0],
  owner: 'studio',
  start: '',
  end: '',
  time: '',
  link: '',
  presencial: false,
  desc: '',
  subs: [],
});

// ordem pedida pela Gabriela: o presente primeiro, depois o futuro, o passado e tudo
// rodada 12: as duas abas que a Gabriela pediu, iguais para studio e cliente
const FILTERS = [
  ['em_andamento', 'Em andamento'],
  ['todas', 'Todas'],
];

export function Timeline({ db, project, isStudio, alvo = null, abrir = () => {} }) {
  const stages = db.stages(project.id);
  const arquivos = (db.subArquivos && db.subArquivos(project.id)) || [];
  const { avisar } = useAvisos();
  const [adding, setAdding] = useState(false);
  const [salvandoEtapa, setSalvandoEtapa] = useState(false);
  const [nf, setNf] = useState(etapaNova);
  const [tplSel, setTplSel] = useState('');
  // Sempre abre em "Em andamento" (pedido da Gabriela, rodada 5), para o
  // studio e para o cliente. Vindo do sino, o filtro se ajusta ao item.
  const [filter, setFilter] = useState('em_andamento');
  const templates = db.templates();
  const tplPreview = templates.find((t) => t.id === tplSel);
  // rodada 12: a mesma visualização para studio e cliente — etapas em
  // cartões que abrem e fecham; "Em andamento" mostra as atuais abertas e
  // "Todas" mostra tudo, com a atual aberta
  const shown = filter === 'todas' ? stages : stages.filter((s) => s.status === filter);
  const foco = (stages.find((s) => s.status === 'em_andamento') || stages.find((s) => s.status !== 'concluida') || {}).id;
  // vindo do sino: se o item pedido está escondido pelo filtro, mostra todas
  useEffect(() => {
    if (!alvo) return;
    const visivel = shown.some(
      (s) => 'etapa-' + s.id === alvo || (s.subs || []).some((b) => 'sub-' + b.id === alvo),
    );
    if (!visivel) setFilter('todas');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo]);

  const salvarComoTemplate = () => {
    const name = window.prompt('Nome do template (as etapas e sub-etapas atuais viram um modelo reutilizável):');
    if (!name || !name.trim()) return;
    db.addTemplate(
      name.trim(),
      stages.map((st) => ({
        title: st.title,
        category: st.category,
        desc: st.desc || '',
        subs: (st.subs || []).map((b) => ({
          title: b.title,
          kind: b.kind || 'tarefa',
          kindLabel: b.kindLabel || '',
          responsible: b.responsible || 'studio',
        })),
      })),
    );
  };

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Etapas do Projeto</h2>
        {isStudio && (
          <div className="head-actions">
            <select className="mini-select" aria-label="Usar template" value={tplSel} onChange={(e) => setTplSel(e.target.value)}>
              <option value="">Usar template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={() => setAdding(!adding)}>
              <Plus size={14} /> Nova etapa
            </button>
            {stages.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={salvarComoTemplate}>
                <Save size={14} /> Salvar como template
              </button>
            )}
          </div>
        )}
      </header>

      {(
      <div className="filter-row">
        {FILTERS.map(([f, label]) => (
          <button key={f} className={'filter' + (filter === f ? ' on' : '')} onClick={() => setFilter(f)}>
            {label}
          </button>
        ))}
      </div>
      )}

      {isStudio && tplPreview && (
        <div className="tpl-preview">
          <div className="tpl-preview-head">
            <strong>{tplPreview.name}</strong>
            <span>{tplPreview.items.length} etapas serão adicionadas a este projeto</span>
          </div>
          <ol className="tpl-preview-list">
            {tplPreview.items.map((it, i) => (
              <li key={i}>
                {it.title} <em>· {it.category}</em>
              </li>
            ))}
          </ol>
          <div className="row">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                db.applyTemplate(project.id, tplPreview.id);
                setTplSel('');
              }}
            >
              Aplicar etapas ao projeto
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setTplSel('')}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {adding && (
        <div className="add-stage">
          <EtapaCampos v={nf} set={setNf} />
          <div className="nf-subs">
            <div className="subs-head">
              <ListChecks size={13} /> Sub-etapas{nf.subs.length > 0 ? ' · ' + nf.subs.length : ''}
            </div>
            {nf.subs.map((b, i) => (
              <div key={i} className="nf-sub-row">
                <span className="nf-sub-title">{b.title}</span>
                <SubResumo b={b} />
                <button
                  type="button"
                  className="icon-x"
                  onClick={() => setNf({ ...nf, subs: nf.subs.filter((_, j) => j !== i) })}
                  aria-label={'Remover a sub-etapa ' + b.title}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <SubForm
              rotuloSalvar="Adicionar sub-etapa"
              limparAoSalvar
              onSalvar={(sub) => setNf({ ...nf, subs: [...nf.subs, sub] })}
            />
          </div>
          {nf.category === 'Reunião' && nf.start && (
            <p className="micro">
              <CalendarIcon size={11} /> Reunião entra no calendário em {fmt(nf.start)}
              {nf.time ? ' às ' + nf.time : ''}.
            </p>
          )}
          <div className="row">
            <button
              className="btn btn-primary btn-sm"
              disabled={!nf.title.trim() || salvandoEtapa}
              onClick={async () => {
                setSalvandoEtapa(true);
                try {
                  await db.addStage(project.id, nf);
                  avisar('Etapa adicionada');
                  setNf(etapaNova());
                  setAdding(false);
                } finally {
                  setSalvandoEtapa(false);
                }
              }}
            >
              {salvandoEtapa ? 'Adicionando…' : 'Adicionar etapa'}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setNf(etapaNova());
                setAdding(false);
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {stages.length === 0 ? (
        <Empty
          text={
            isStudio
              ? 'Nenhuma etapa ainda. Use um template ou “Nova etapa” para montar o cronograma.'
              : 'As etapas do projeto aparecem aqui assim que o studio montar o cronograma.'
          }
        />
      ) : shown.length === 0 ? (
        <Empty
          text={
            filter === 'em_andamento'
              ? 'Nenhuma etapa em andamento agora. Veja em “Todas”.'
              : 'Nenhuma etapa neste filtro.'
          }
        />
      ) : (
        <ol className="timeline" key={filter}>
          {shown.map((s) => (
            <StageItem
              key={s.id}
              db={db}
              s={s}
              isStudio={isStudio}
              arquivos={arquivos}
              abrir={abrir}
              projectId={project.id}
              inicialAberta={filter === 'em_andamento' || s.id === foco}
              alvo={alvo}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

/* Campos da etapa (macro), iguais em "Nova etapa" e "Editar". */
function EtapaCampos({ v, set }) {
  return (
    <>
      <input placeholder="Nome da etapa" aria-label="Título da etapa" value={v.title} onChange={(e) => set({ ...v, title: e.target.value })} />
      <div className="add-row">
        <label className="inline-lab">
          Tipo
          <select value={v.category} onChange={(e) => set({ ...v, category: e.target.value })}>
            {!STAGE_CATEGORIES.includes(v.category) && v.category && <option>{v.category}</option>}
            {STAGE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="inline-lab">
          Responsável
          <select value={v.owner} onChange={(e) => set({ ...v, owner: e.target.value })}>
            <option value="studio">Studio</option>
            <option value="client">Cliente</option>
          </select>
        </label>
      </div>
      <div className="add-row">
        <label className="inline-lab">
          Início
          <input type="date" value={v.start || ''} onChange={(e) => set({ ...v, start: e.target.value })} />
        </label>
        <label className="inline-lab">
          Previsão de fim
          <input type="date" value={v.end || ''} onChange={(e) => set({ ...v, end: e.target.value })} />
        </label>
      </div>
      {v.category === 'Reunião' && (
        <div className="meet-fields">
          <label className="inline-lab">
            <Clock size={13} /> Horário
            <input type="time" value={v.time || ''} onChange={(e) => set({ ...v, time: e.target.value })} />
          </label>
          <div className="seg-toggle">
            <button type="button" className={'seg-opt' + (!v.presencial ? ' on' : '')} onClick={() => set({ ...v, presencial: false })}>
              <Video size={13} /> Online
            </button>
            <button type="button" className={'seg-opt' + (v.presencial ? ' on' : '')} onClick={() => set({ ...v, presencial: true })}>
              <MapPin size={13} /> Presencial
            </button>
          </div>
          {!v.presencial && (
            <input placeholder="Link da reunião (ex.: https://meet.google.com/...)" aria-label="Link da reunião" value={v.link || ''} onChange={(e) => set({ ...v, link: e.target.value })} />
          )}
        </div>
      )}
      <input placeholder="Descrição (opcional)" aria-label="Descrição da etapa" value={v.desc || ''} onChange={(e) => set({ ...v, desc: e.target.value })} />
    </>
  );
}

/* Formulário de uma sub-etapa: o mesmo para criar e para editar. */
function SubForm({ inicial, onSalvar, onCancelar, rotuloSalvar = 'Salvar', limparAoSalvar = false }) {
  const [sd, setSd] = useState(() => ({ ...subCompletaVazia(), ...(inicial || {}) }));
  const comHorario = SUB_COM_HORARIO.includes(sd.kind);
  const pronto = sd.title.trim() && (sd.kind !== 'outro' || (sd.kindLabel || '').trim());
  const salvar = () => {
    if (!pronto) return;
    onSalvar({ ...sd, title: sd.title.trim(), kindLabel: sd.kind === 'outro' ? sd.kindLabel.trim() : '' });
    if (limparAoSalvar) setSd(subCompletaVazia());
  };
  return (
    <div className="sub-form">
      <input
        className="sub-form-titulo"
        placeholder="Nome da sub-etapa"
        aria-label="Título da sub-etapa"
        value={sd.title}
        onChange={(e) => setSd({ ...sd, title: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') salvar();
        }}
      />
      <div className="sub-form-grade">
        <label className="inline-lab">
          Tipo
          <select value={sd.kind} onChange={(e) => setSd({ ...sd, kind: e.target.value })}>
            {SUB_TIPOS.map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </label>
        {sd.kind === 'outro' && (
          <label className="inline-lab">
            Nome do tipo
            <input maxLength={40} placeholder="Nome do tipo" value={sd.kindLabel || ''} onChange={(e) => setSd({ ...sd, kindLabel: e.target.value })} />
          </label>
        )}
        <label className="inline-lab">
          Responsável
          <select
            value={sd.responsible}
            onChange={(e) =>
              // rodada 12: tarefa do cliente já nasce pedindo arquivos (dá para desmarcar)
              setSd({ ...sd, responsible: e.target.value, pedeArquivos: e.target.value === 'cliente' ? true : sd.pedeArquivos })
            }
          >
            {SUB_RESPONSAVEIS.map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-lab">
          {comHorario ? 'Data' : 'Prazo'}
          <input type="date" value={sd.due || ''} onChange={(e) => setSd({ ...sd, due: e.target.value })} />
        </label>
        {comHorario && (
          <label className="inline-lab">
            Horário
            <input type="time" value={sd.time || ''} onChange={(e) => setSd({ ...sd, time: e.target.value })} />
          </label>
        )}
      </div>
      <label className="sub-form-pede">
        <input
          type="checkbox"
          checked={!!sd.pedeArquivos}
          onChange={(e) =>
            setSd({ ...sd, pedeArquivos: e.target.checked, responsible: e.target.checked ? 'cliente' : sd.responsible })
          }
        />{' '}
        Pedir arquivos ao cliente (ele envia pela aba Documentos → Envios do Cliente)
      </label>
      {/* rodada 6: toda sub-etapa pode ter uma descrição curta, que aparece
          embaixo do nome; num pedido de arquivos, diz o que mandar */}
      <textarea
        className="sub-form-instrucoes"
        rows={2}
        maxLength={600}
        placeholder={
          sd.pedeArquivos
            ? 'O que o cliente deve mandar (ex.: plantas do apartamento, fotos de cada ambiente)'
            : 'Descrição curta (opcional)'
        }
        aria-label={sd.pedeArquivos ? 'Instruções do pedido de arquivos' : 'Descrição da sub-etapa'}
        value={sd.instructions || ''}
        onChange={(e) => setSd({ ...sd, instructions: e.target.value })}
      />
      {sd.kind === 'reuniao' && (
        <div className="sub-form-reuniao">
          <div className="seg">
            <button type="button" className={'seg-opt' + (sd.format !== 'presencial' ? ' on' : '')} onClick={() => setSd({ ...sd, format: 'online' })}>
              <Video size={13} /> Online
            </button>
            <button type="button" className={'seg-opt' + (sd.format === 'presencial' ? ' on' : '')} onClick={() => setSd({ ...sd, format: 'presencial' })}>
              <MapPin size={13} /> Presencial
            </button>
          </div>
          {sd.format !== 'presencial' && (
            <input placeholder="Link da reunião" aria-label="Link da reunião" value={sd.link || ''} onChange={(e) => setSd({ ...sd, link: e.target.value })} />
          )}
        </div>
      )}
      <div className="row">
        <button type="button" className="btn btn-primary btn-sm" disabled={!pronto} onClick={salvar}>
          {limparAoSalvar ? <Plus size={13} /> : null} {rotuloSalvar}
        </button>
        {onCancelar && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

/* Tipo, responsável e prazo de uma sub-etapa, sempre visíveis e com nome. */
/* Tipo e responsável, só quando dizem algo: "Tarefa" e "Studio" são o
   padrão e não aparecem (rodada 5, para a lista ficar mais limpa). */
function SubResumo({ b, comPrazo = true }) {
  const tipo = b.kind && b.kind !== 'tarefa' ? rotuloTipoSub(b) : null;
  const resp = b.responsible && b.responsible !== 'studio' ? b.responsible : null;
  if (!tipo && !resp && !(comPrazo && b.due)) return null;
  return (
    <span className="sub-chips">
      {tipo && <span className="sub-tipo">{tipo}</span>}
      {resp && (
        <span className={'sub-chip sub-resp sub-resp-' + resp}>
          <User size={10} /> {ROTULO_RESP[resp]}
        </span>
      )}
      {comPrazo && b.due && <SubPrazo b={b} />}
    </span>
  );
}

/* Prazo da sub-etapa; na linha do tempo fica alinhado à direita, numa
   coluna só, para ser fácil de bater o olho (pedido da Gabriela). */
function SubPrazo({ b }) {
  const pz = prazoSub(b);
  return (
    <span className={'sub-chip sub-prazo sub-prazo-' + pz.estado}>
      {pz.estado === 'atrasado' ? <AlertTriangle size={10} /> : <CalendarDays size={10} />} {pz.texto}
    </span>
  );
}

/* Uma sub-etapa na lista (rodada 6, desenho da Gabriela): bolinha numa
   linha pontilhada, nome em destaque, tipo + descrição curta embaixo e, à
   direita, a data e a ação (fazer upload, entrar na reunião). O cliente não
   tem caixinha para marcar; o studio conclui clicando na bolinha. */
function SubItem({ db, s, b, i, total, isStudio, atual = false, arquivos = [], abrir }) {
  const [editando, setEditando] = useState(false);
  // rodada 11: setas/lápis/X controlados pelo app (não só pelo CSS): aparecem
  // com o mouse em cima e somem ao sair ou depois de usar uma delas — no
  // Safari o ":hover" ficava preso depois de um clique
  const [acoesVisiveis, setAcoesVisiveis] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const { avisar, excluirComDesfazer, ocultos } = useAvisos();
  if (ocultos.has(b.id)) return null;
  if (editando)
    return (
      <li className="sub sub-editando">
        <SubForm
          inicial={b}
          rotuloSalvar="Salvar sub-etapa"
          onCancelar={() => setEditando(false)}
          onSalvar={async (d) => {
            setEditando(false);
            await db.updateSub(s.id, b.id, d);
            avisar('Sub-etapa salva');
          }}
        />
      </li>
    );
  const enviados = arquivos.filter((a) => a.subId === b.id).length;
  const doCliente = b.responsible === 'cliente';
  const entregue = !!b.entregueEm || b.done;
  let q = quandoSub(b);
  // cliente: tarefa do studio que passou do prazo não aparece como "Vencido"
  if (!isStudio && q && q.estado === 'atrasado' && b.responsible !== 'cliente')
    q = SUB_COM_HORARIO.includes(b.kind) ? { ...q, estado: 'ok' } : null;
  const irEnvio = () => abrir('docs', 'pedido-' + b.id);
  let acao = null;
  if (b.pedeArquivos && !isStudio)
    acao = entregue ? (
      <span className="sub-acao sub-entregue">
        <Check size={11} /> Entregue
      </span>
    ) : (
      <button type="button" className="sub-acao" onClick={irEnvio}>
        <FolderUp size={12} /> {enviados ? 'Concluir entrega' : 'Fazer upload'}
      </button>
    );
  else if (!isStudio && doCliente && !b.pedeArquivos && !b.done)
    // rodada 12: tarefa do cliente sem arquivos — ele mesmo marca como feita
    acao = (
      <button
        type="button"
        className="sub-acao"
        disabled={concluindo}
        onClick={async () => {
          setConcluindo(true);
          try {
            await db.concluirTarefa(s.id, b.id);
            avisar('Tarefa concluída');
          } finally {
            setConcluindo(false);
          }
        }}
      >
        <Check size={12} /> {concluindo ? 'Salvando…' : 'Marcar como feita'}
      </button>
    );
  else if (b.pedeArquivos && isStudio && b.entregueEm && !b.done)
    acao = (
      <button type="button" className="sub-acao" onClick={irEnvio}>
        <FolderUp size={12} /> Conferir entrega
      </button>
    );
  else if (b.kind === 'reuniao' && b.format !== 'presencial' && b.link && !b.done)
    acao = (
      <a className="sub-acao" href={b.link} target="_blank" rel="noreferrer">
        <Video size={12} /> Entrar na reunião
      </a>
    );
  const classe = 'sub' + (b.done ? ' done' : '') + (atual ? ' sub-atual' : '') + (doCliente && !b.done ? ' sub-do-cliente' : '');
  return (
    <li
      className={classe}
      id={'alvo-sub-' + b.id}
      // rodada 12: só eventos do ponteiro, sem depender de "(hover:hover)" do
      // navegador — mouse: aparece ao entrar e some ao sair; toque (iPad):
      // um toque na linha mostra, outro esconde
      onPointerEnter={(e) => e.pointerType !== 'touch' && setAcoesVisiveis(true)}
      onPointerLeave={(e) => e.pointerType !== 'touch' && setAcoesVisiveis(false)}
      onPointerDown={(e) => e.pointerType === 'touch' && !e.target.closest('.sub-acoes') && setAcoesVisiveis((v) => !v)}
      onFocus={(e) => e.target.matches && e.target.matches(':focus-visible') && setAcoesVisiveis(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setAcoesVisiveis(false)}
    >
      {isStudio ? (
        <button className="sub-no" onClick={() => db.toggleSub(s.id, b.id)} aria-label={(b.done ? 'Desmarcar ' : 'Concluir ') + b.title}>
          <Check size={11} />
        </button>
      ) : (
        <span className="sub-no" aria-hidden>
          {b.done && <Check size={11} />}
        </span>
      )}
      <div className="sub-corpo">
        <div className="sub-linha1">
          <span className="sub-title">{b.title}</span>
        </div>
        {/* rodada 13: tipo, prazo e ação numa linha só, colados ao título
            (antes o prazo ficava solto numa coluna à direita) */}
        <div className="sub-linha2 sub-meta">
          {/* rodada 12: o cliente vê igual ao studio ("Tarefa – Cliente", em vinho) */}
          <span className={'sub-tipo-tag' + (doCliente ? ' sub-tipo-cliente' : '')}>
            {rotuloTipoSub(b)}
            {ROTULO_RESP[b.responsible] && b.responsible !== 'studio' ? ' – ' + ROTULO_RESP[b.responsible] : ''}
          </span>
          {q && (
            <span className={'sub-prazo-txt sub-prazo-txt-' + q.estado}>{textoQuando(q, b)}</span>
          )}
          {b.kind === 'reuniao' && b.format === 'presencial' && <span className="sub-prazo-txt">Presencial</span>}
          {isStudio && b.pedeArquivos && (
            <button type="button" className="sub-acao" onClick={irEnvio}>
              <FolderUp size={11} />{' '}
              {enviados ? enviados + (enviados === 1 ? ' arquivo enviado' : ' arquivos enviados') : 'Nenhum arquivo ainda'}
            </button>
          )}
          {acao}
        </div>
        {b.instructions && <p className="sub-desc sub-instrucoes">{b.instructions}</p>}
      </div>
      {isStudio && (
        <span
          className={'sub-acoes' + (acoesVisiveis ? ' visivel' : '')}
          style={{ visibility: acoesVisiveis ? 'visible' : 'hidden', opacity: 1 }}
          onClick={() => setAcoesVisiveis(false)}
        >
          <button className="icon-x" disabled={i === 0} onClick={() => db.moveSub(s.id, b.id, -1)} aria-label={'Subir ' + b.title}>
            <ArrowUp size={12} />
          </button>
          <button className="icon-x" disabled={i === total - 1} onClick={() => db.moveSub(s.id, b.id, 1)} aria-label={'Descer ' + b.title}>
            <ArrowDown size={12} />
          </button>
          <button className="icon-x" onClick={() => setEditando(true)} aria-label={'Editar ' + b.title}>
            <PenLine size={12} />
          </button>
          <button
            className="icon-x"
            onClick={() => {
              excluirComDesfazer({ id: b.id, texto: 'Sub-etapa "' + b.title + '" excluída', executar: () => db.deleteSub(s.id, b.id) });
            }}
            aria-label={'Excluir ' + b.title}
          >
            <X size={12} />
          </button>
        </span>
      )}
    </li>
  );
}

/* Prazo da sub-etapa em texto curto, para a linha do tipo (rodada 13):
   "Venceu em 10/06", "Hoje · 15:00", "Até 30/10", "12/11 · 10:00". */
function textoQuando(q, b) {
  const marcado = SUB_COM_HORARIO.includes(b.kind);
  if (q.estado === 'atrasado' && !marcado) return 'Venceu em ' + q.hora;
  return q.data + (q.hora ? ' · ' + q.hora : '');
}

/* Datas da etapa à direita: "Prazos Previstos", com Início e Entrega
   embaixo (rodada 7) */
function DatasEtapa({ s }) {
  const reuniao = s.category === 'Reunião';
  // rodada 12: símbolos no lugar de "Início –" e "Entrega –", para as datas
  // caberem dentro da largura de "Prazos Previstos"
  const linhas = [];
  if (s.start)
    linhas.push({ I: reuniao ? Clock : Play, rot: reuniao ? 'Data' : 'Início', txt: fmt(s.start) + (s.time ? ' · ' + s.time : '') });
  if (s.end && s.end !== s.start) linhas.push({ I: Flag, rot: 'Entrega', txt: fmt(s.end) });
  return (
    <span className="tl-datas">
      <span className="tl-datas-tit">
        <CalendarDays size={12} /> {reuniao ? 'Data Prevista' : 'Prazos Previstos'}
      </span>
      {linhas.length === 0 ? (
        <span className="tl-datas-linha">A definir</span>
      ) : (
        linhas.map(({ I, rot, txt }) => (
          <span key={rot} className="tl-datas-linha" title={rot}>
            <I size={10} aria-hidden /> <span className="sr-only">{rot}: </span>
            {txt}
          </span>
        ))
      )}
    </span>
  );
}

function StageItem({ db, s, isStudio, arquivos, abrir, projectId, inicialAberta = true, alvo = null }) {
  const [editing, setEditing] = useState(false);
  const { excluirComDesfazer, ocultos } = useAvisos();
  const [aberta, setAberta] = useState(inicialAberta);
  // vindo do sino ou do "próximo passo": abre a etapa do item pedido
  useEffect(() => {
    if (alvo && ('etapa-' + s.id === alvo || (s.subs || []).some((b) => 'sub-' + b.id === alvo))) setAberta(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo]);
  const [ef, setEf] = useState(s);
  const [addingSub, setAddingSub] = useState(false);
  const [newEnd, setNewEnd] = useState(s.end || '');
  const atrasada = stageOverdue(s);
  // rodada 10: atraso do studio não assusta o cliente; para ele aparece
  // "Nova data em definição", em tom neutro. Atraso do cliente segue em
  // vermelho, porque depende dele.
  const late = atrasada && (isStudio || s.owner === 'client');
  const novaData = atrasada && !late;
  const ss = subStats(s);
  // a primeira sub-etapa ainda aberta ganha o destaque da bolinha
  const primeiraAberta = ((s.subs || []).find((b) => !b.done) || {}).id;
  const startEdit = () => {
    setEf({ ...s });
    setEditing(true);
  };
  const saveEdit = () => {
    db.updateStage(s.id, {
      title: ef.title,
      category: ef.category,
      owner: ef.owner,
      start: ef.start,
      end: ef.end,
      time: ef.time,
      link: ef.link,
      presencial: ef.presencial,
      desc: ef.desc,
    });
    setEditing(false);
  };

  if (ocultos.has(s.id)) return null;
  if (editing) {
    return (
      <li className="tl-item tl-edit">
        <span className="tl-rail" aria-hidden />
        <span className="tl-node" aria-hidden />
        <div className="tl-body">
          <div className="add-stage">
            <EtapaCampos v={ef} set={setEf} />
            <div className="row">
              <button className="btn btn-primary btn-sm" disabled={!ef.title.trim()} onClick={saveEdit}>
                Salvar
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className={'tl-item tl-' + s.status + (late ? ' tl-late' : '')} id={'alvo-etapa-' + s.id}>
      <span className="tl-rail" aria-hidden />
      <span className="tl-node" aria-hidden>
        {s.status === 'concluida' ? <Check size={13} /> : s.status === 'em_andamento' ? <span className="tl-dot" /> : null}
      </span>
      <div className={'tl-body' + (aberta ? '' : ' tl-recolhida')}>
        {/* rodada 11: título e status à esquerda; prazos e "⋯" à direita */}
        <div className="tl-top tl-cab">
          <div className="tl-cab-esq">
            {/* rodada 12: studio e cliente abrem e fecham a etapa do mesmo jeito */}
            <button type="button" className="tl-abrir" aria-expanded={aberta} onClick={() => setAberta(!aberta)}>
              <ChevronDown size={16} className="tl-seta" aria-hidden />
              <h3>{s.title}</h3>
            </button>
          <div className="tl-meta">
            {/* rodada 5: na etapa macro não se repete "Etapa" nem o studio
                como responsável; aparece só o que acrescenta */}
            {s.category && s.category !== 'Etapa' && <span className="tag">{s.category}</span>}
            {s.category === 'Reunião' && (
              <span className="tag tag-loc">
                {s.presencial ? <MapPin size={11} /> : <Video size={11} />} {s.presencial ? 'Presencial' : 'Online'}
              </span>
            )}
            {s.owner === 'client' && (
              <span className="tag tag-owner owner-client">
                <User size={11} /> Responsável: Cliente
              </span>
            )}
            {s.rescheduledFrom && (
              <span className="tag tag-resched">
                <CalendarClock size={11} /> Reagendada de {fmt(s.rescheduledFrom)}
              </span>
            )}
            {/* studio: o status é um seletor no próprio balão (rodada 10) */}
            {isStudio && (
              <StatusSelect status={s.status} opcoes={STAGE_STATUS} onChange={(v) => db.setStageStatus(s.id, v)} />
            )}
            {late ? (
              <span className="pill pill-late">
                <AlertTriangle size={12} /> Em atraso
              </span>
            ) : isStudio ? null : novaData ? (
              <span className="pill pill-next">
                <CalendarClock size={12} /> Nova data em definição
              </span>
            ) : (
              <StatusPill status={s.status} />
            )}
          </div>
          </div>
          <div className="tl-cab-dir">
            <DatasEtapa s={s} />
          </div>
        </div>

        {aberta && (
        <>

        {s.category === 'Reunião' && !s.presencial && s.link && (
          <a className="meet-link" href={s.link} target="_blank" rel="noreferrer">
            <Link2 size={13} /> Entrar na reunião
          </a>
        )}

        {late && (
          <div className="late-box">
            <div className="late-msg">
              <AlertTriangle size={13} />{' '}
              <span>
                Prazo venceu em {fmt(s.end)}.{' '}
                {isStudio
                  ? ''
                  : s.owner === 'client'
                    ? 'Anexe as documentações em Documentos. Depois disso, o studio define uma nova data de entrega.'
                    : 'Uma nova análise de prazo será feita pelo studio.'}
              </span>
            </div>
            {isStudio && (
              <div className="reschedule">
                <label className="inline-lab">
                  Nova data de entrega
                  <input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
                </label>
                <button className="btn btn-primary btn-sm" disabled={!newEnd} onClick={() => db.rescheduleStage(s.id, newEnd)}>
                  Reagendar
                </button>
              </div>
            )}
          </div>
        )}

        {(ss.total > 0 || isStudio) && (
          <div className="subs">
            {ss.total > 0 && (
              <ul className="sub-list">
                {(s.subs || []).map((b, i) => (
                  <SubItem
                    atual={s.status === 'em_andamento' && b.id === primeiraAberta}
                    key={b.id}
                    db={db}
                    s={s}
                    b={b}
                    i={i}
                    total={s.subs.length}
                    isStudio={isStudio}
                    arquivos={arquivos}
                    abrir={abrir}
                  />
                ))}
              </ul>
            )}
            {isStudio &&
              (addingSub ? (
                <div className="sub-add">
                  <SubForm
                    rotuloSalvar="Adicionar"
                    limparAoSalvar
                    onCancelar={() => setAddingSub(false)}
                    onSalvar={(d) => db.addSub(s.id, d)}
                  />
                </div>
              ) : (
                <button className="link sm" onClick={() => setAddingSub(true)}>
                  <Plus size={12} /> Adicionar sub-etapa
                </button>
              ))}
          </div>
        )}

        {s.desc && <p className="tl-desc-inline">{s.desc}</p>}

        <AprovacaoEtapa db={db} s={s} isStudio={isStudio} projectId={projectId} />

        {/* rodada 12: editar/excluir a etapa no rodapé, fora do topo (que fica
            igual ao do cliente) */}
        {isStudio && (
          <div className="tl-rodape">
            <MenuMais
              rotulo={'Mais ações da etapa ' + s.title}
              itens={[
                { rotulo: 'Editar etapa', Icone: PenLine, acao: startEdit },
                {
                  rotulo: 'Excluir etapa',
                  Icone: Trash2,
                  perigo: true,
                  acao: () => {
                    excluirComDesfazer({ id: s.id, texto: 'Etapa "' + s.title + '" excluída', executar: () => db.deleteStage(s.id) });
                  },
                },
              ]}
            />
          </div>
        )}

        </>
        )}
      </div>
    </li>
  );
}
