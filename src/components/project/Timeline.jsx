import { useState } from 'react';
import {
  Plus, Clock, Video, MapPin, Calendar as CalendarIcon, CalendarDays, User, CalendarClock,
  Link2, AlertTriangle, ListChecks, Check, X, PenLine, Trash2,
} from 'lucide-react';
import { StatusPill, Empty } from '../atoms.jsx';
import { STAGE_STATUS, STAGE_CATEGORIES } from '../../lib/constants.js';
import { stageOverdue, subStats, fmt } from '../../lib/helpers.js';

export function Timeline({ db, project, isStudio }) {
  const stages = db.stages(project.id);
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState({ title: '', category: 'Reunião', owner: 'studio', start: '', end: '', time: '', link: '', presencial: false, desc: '' });
  const [tplSel, setTplSel] = useState('');
  const [filter, setFilter] = useState('todas');
  const templates = db.templates();
  const tplPreview = templates.find((t) => t.id === tplSel);
  const resetNf = () => setNf({ title: '', category: 'Reunião', owner: 'studio', start: '', end: '', time: '', link: '', presencial: false, desc: '' });
  const FILTERS = [['todas', 'Todas'], ['em_andamento', 'Em andamento'], ['a_fazer', 'Futuras'], ['concluida', 'Concluídas']];
  const count = (f) => (f === 'todas' ? stages.length : stages.filter((s) => s.status === f).length);
  const shown = filter === 'todas' ? stages : stages.filter((s) => s.status === filter);

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Etapas do projeto</h2>
        {isStudio && (
          <div className="head-actions">
            <select className="mini-select" value={tplSel} onChange={(e) => setTplSel(e.target.value)}>
              <option value="">Usar template…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={() => setAdding(!adding)}><Plus size={14} /> Nova etapa</button>
          </div>
        )}
      </header>

      <div className="filter-row">
        {FILTERS.map(([f, label]) => <button key={f} className={'filter' + (filter === f ? ' on' : '')} onClick={() => setFilter(f)}>{label} ({count(f)})</button>)}
      </div>

      {isStudio && tplPreview && (
        <div className="tpl-preview">
          <div className="tpl-preview-head">
            <strong>{tplPreview.name}</strong>
            <span>{tplPreview.items.length} etapas serão adicionadas a este projeto</span>
          </div>
          <ol className="tpl-preview-list">
            {tplPreview.items.map((it, i) => <li key={i}>{it.title} <em>· {it.category}</em></li>)}
          </ol>
          <div className="row">
            <button className="btn btn-primary btn-sm" onClick={() => { db.applyTemplate(project.id, tplPreview.id); setTplSel(''); }}>Aplicar etapas ao projeto</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setTplSel('')}>Cancelar</button>
          </div>
        </div>
      )}

      {adding && (
        <div className="add-stage">
          <input placeholder="Título da etapa" value={nf.title} onChange={(e) => setNf({ ...nf, title: e.target.value })} />
          <div className="add-row">
            <select value={nf.category} onChange={(e) => setNf({ ...nf, category: e.target.value })}>{STAGE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={nf.owner} onChange={(e) => setNf({ ...nf, owner: e.target.value })}><option value="studio">Responsável: Studio</option><option value="client">Responsável: Cliente</option></select>
          </div>
          <div className="add-row">
            <label className="inline-lab">Início<input type="date" value={nf.start} onChange={(e) => setNf({ ...nf, start: e.target.value })} /></label>
            <label className="inline-lab">Previsão de fim<input type="date" value={nf.end} onChange={(e) => setNf({ ...nf, end: e.target.value })} /></label>
          </div>
          {nf.category === 'Reunião' && (
            <div className="meet-fields">
              <label className="inline-lab"><Clock size={13} /> Horário<input type="time" value={nf.time} onChange={(e) => setNf({ ...nf, time: e.target.value })} /></label>
              <div className="seg-toggle">
                <button type="button" className={'seg-opt' + (!nf.presencial ? ' on' : '')} onClick={() => setNf({ ...nf, presencial: false })}><Video size={13} /> Online</button>
                <button type="button" className={'seg-opt' + (nf.presencial ? ' on' : '')} onClick={() => setNf({ ...nf, presencial: true })}><MapPin size={13} /> Presencial</button>
              </div>
              {!nf.presencial && <input placeholder="Link da reunião (ex.: https://meet.google.com/...)" value={nf.link} onChange={(e) => setNf({ ...nf, link: e.target.value })} />}
            </div>
          )}
          <input placeholder="Descrição (opcional)" value={nf.desc} onChange={(e) => setNf({ ...nf, desc: e.target.value })} />
          {nf.category === 'Reunião' && nf.start && <p className="micro"><CalendarIcon size={11} /> Reunião entra no calendário em {fmt(nf.start)}{nf.time ? ' às ' + nf.time : ''}.</p>}
          <div className="row">
            <button className="btn btn-primary btn-sm" disabled={!nf.title.trim()} onClick={() => { db.addStage(project.id, nf); resetNf(); setAdding(false); }}>Adicionar</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { resetNf(); setAdding(false); }}>Cancelar</button>
          </div>
        </div>
      )}

      {stages.length === 0 ? <Empty text="Nenhuma etapa ainda. Use um template ou adicione manualmente." />
        : shown.length === 0 ? <Empty text="Nenhuma etapa neste filtro." />
        : <ol className="timeline" key={filter}>{shown.map((s) => <StageItem key={s.id} db={db} s={s} isStudio={isStudio} />)}</ol>}
    </section>
  );
}

function StageItem({ db, s, isStudio }) {
  const [editing, setEditing] = useState(false);
  const [ef, setEf] = useState(s);
  const [addingSub, setAddingSub] = useState(false);
  const [subText, setSubText] = useState('');
  const [newEnd, setNewEnd] = useState(s.end || '');
  const late = stageOverdue(s);
  const ss = subStats(s);
  const startEdit = () => { setEf({ ...s }); setEditing(true); };
  const saveEdit = () => { db.updateStage(s.id, { title: ef.title, category: ef.category, owner: ef.owner, start: ef.start, end: ef.end, time: ef.time, link: ef.link, presencial: ef.presencial, desc: ef.desc }); setEditing(false); };

  if (editing) {
    return (
      <li className="tl-item tl-edit">
        <span className="tl-rail" aria-hidden />
        <span className="tl-node" aria-hidden />
        <div className="tl-body">
          <div className="add-stage">
            <input placeholder="Título da etapa" value={ef.title} onChange={(e) => setEf({ ...ef, title: e.target.value })} />
            <div className="add-row">
              <select value={ef.category} onChange={(e) => setEf({ ...ef, category: e.target.value })}>{STAGE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
              <select value={ef.owner} onChange={(e) => setEf({ ...ef, owner: e.target.value })}><option value="studio">Responsável: Studio</option><option value="client">Responsável: Cliente</option></select>
            </div>
            <div className="add-row">
              <label className="inline-lab">Início<input type="date" value={ef.start || ''} onChange={(e) => setEf({ ...ef, start: e.target.value })} /></label>
              <label className="inline-lab">Previsão de fim<input type="date" value={ef.end || ''} onChange={(e) => setEf({ ...ef, end: e.target.value })} /></label>
            </div>
            {ef.category === 'Reunião' && (
              <div className="meet-fields">
                <label className="inline-lab"><Clock size={13} /> Horário<input type="time" value={ef.time || ''} onChange={(e) => setEf({ ...ef, time: e.target.value })} /></label>
                <div className="seg-toggle">
                  <button type="button" className={'seg-opt' + (!ef.presencial ? ' on' : '')} onClick={() => setEf({ ...ef, presencial: false })}><Video size={13} /> Online</button>
                  <button type="button" className={'seg-opt' + (ef.presencial ? ' on' : '')} onClick={() => setEf({ ...ef, presencial: true })}><MapPin size={13} /> Presencial</button>
                </div>
                {!ef.presencial && <input placeholder="Link da reunião" value={ef.link || ''} onChange={(e) => setEf({ ...ef, link: e.target.value })} />}
              </div>
            )}
            <input placeholder="Descrição (opcional)" value={ef.desc || ''} onChange={(e) => setEf({ ...ef, desc: e.target.value })} />
            <div className="row">
              <button className="btn btn-primary btn-sm" disabled={!ef.title.trim()} onClick={saveEdit}>Salvar</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className={'tl-item tl-' + s.status + (late ? ' tl-late' : '')}>
      <span className="tl-rail" aria-hidden />
      <span className="tl-node" aria-hidden>{s.status === 'concluida' ? <Check size={13} /> : s.status === 'em_andamento' ? <span className="tl-dot" /> : null}</span>
      <div className="tl-body">
        <div className="tl-top">
          <h3>{s.title}</h3>
          <span className="tl-date"><CalendarDays size={12} /> {fmt(s.start)}{!late && s.end && s.end !== s.start ? ' → ' + fmt(s.end) : ''}{s.time ? ' · ' + s.time : ''}</span>
        </div>
        <div className="tl-meta">
          <span className="tag">{s.category}</span>
          {s.category === 'Reunião' && !s.presencial && <span className="tag tag-loc"><Video size={11} /> Online</span>}
          {s.owner === 'client' && <span className="tag tag-owner owner-client"><User size={11} /> Responsabilidade: Cliente</span>}
          {s.rescheduledFrom && <span className="tag tag-resched"><CalendarClock size={11} /> Reagendada de {fmt(s.rescheduledFrom)}</span>}
          {late ? <span className="pill pill-late"><AlertTriangle size={12} /> Em atraso</span> : <StatusPill status={s.status} />}
        </div>

        {s.category === 'Reunião' && !s.presencial && s.link && (
          <a className="meet-link" href={s.link} target="_blank" rel="noreferrer"><Link2 size={13} /> Entrar na reunião</a>
        )}

        {late && (
          <div className="late-box">
            <div className="late-msg"><AlertTriangle size={15} /> <span>Prazo venceu em {fmt(s.end)}. {isStudio ? 'Defina a nova data de entrega abaixo.' : s.owner === 'client' ? 'Anexe as documentações em Documentos. Depois disso, o studio define uma nova data de entrega.' : 'Uma nova análise de prazo será feita pelo studio.'}</span></div>
            {isStudio && (
              <div className="reschedule">
                <label className="inline-lab"><CalendarClock size={13} /> Nova data de entrega<input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} /></label>
                <button className="btn btn-primary btn-sm" disabled={!newEnd} onClick={() => db.rescheduleStage(s.id, newEnd)}>Reagendar</button>
              </div>
            )}
          </div>
        )}

        {(ss.total > 0 || isStudio) && (
          <div className="subs">
            <div className="subs-head"><ListChecks size={13} /> Sub-etapas{ss.total > 0 ? ' · ' + ss.done + '/' + ss.total : ''}</div>
            {ss.total > 0 && (
              <ul className="sub-list">
                {(s.subs || []).map((b) => (
                  <li key={b.id} className={'sub' + (b.done ? ' done' : '')}>
                    {isStudio
                      ? <button className={'sub-box' + (b.done ? ' on' : '')} onClick={isStudio ? () => db.toggleSub(s.id, b.id) : undefined} disabled={!isStudio} aria-label="alternar">{b.done && <Check size={11} />}</button>
                      : <span className={'sub-box' + (b.done ? ' on' : '')}>{b.done && <Check size={11} />}</span>}
                    <span className="sub-title">{b.title}</span>
                    {isStudio && <button className="icon-x" onClick={() => db.deleteSub(s.id, b.id)} aria-label="remover"><X size={12} /></button>}
                  </li>
                ))}
              </ul>
            )}
            {isStudio && (addingSub ? (
              <div className="sub-add">
                <input placeholder="Nova sub-etapa" value={subText} onChange={(e) => setSubText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && subText.trim()) { db.addSub(s.id, subText.trim()); setSubText(''); } }} />
                <button className="btn btn-primary btn-sm" disabled={!subText.trim()} onClick={() => { db.addSub(s.id, subText.trim()); setSubText(''); }}>Add</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setAddingSub(false); setSubText(''); }}>Fechar</button>
              </div>
            ) : <button className="link sm" onClick={() => setAddingSub(true)}><Plus size={12} /> Adicionar sub-etapa</button>)}
          </div>
        )}

        {s.desc && <p className="tl-desc-inline">{s.desc}</p>}

        {isStudio && (
          <div className="status-set">
            {STAGE_STATUS.map((st) => (
              <button key={st.id} className={'chip' + (s.status === st.id ? ' chip-on' : '')} onClick={() => db.setStageStatus(s.id, st.id)}>{st.label}</button>
            ))}
            <button className="chip" onClick={startEdit}><PenLine size={12} /> Editar</button>
            <button className="chip chip-del" title="Excluir etapa" onClick={() => { if (window.confirm('Excluir a etapa "' + s.title + '"?')) db.deleteStage(s.id); }}><Trash2 size={12} /> Excluir</button>
          </div>
        )}
      </div>
    </li>
  );
}
