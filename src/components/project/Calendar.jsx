import { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, MapPin, Video, Link2 } from 'lucide-react';
import { WEEK } from '../../lib/constants.js';
import { fmt, todayISO } from '../../lib/helpers.js';

const labelKind = (k) =>
  ({ reuniao: 'Reunião', entrega: 'Entrega', pagamento: 'Pagamento', visita: 'Visita', prazo: 'Prazo do cliente', atraso: 'Em atraso', evento: 'Evento' }[k] || 'Evento');

export function Calendar({ db, project, isStudio }) {
  const events = db.calendarEvents(project.id);
  const now = new Date();
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [sel, setSel] = useState(todayISO());
  const [adding, setAdding] = useState(false);
  const [ev, setEv] = useState({ title: '', date: todayISO(), kind: 'evento' });

  const byDay = {};
  events.forEach((e) => { (byDay[e.date] = byDay[e.date] || []).push(e); });
  const first = new Date(cur.y, cur.m, 1);
  const pad = first.getDay();
  const days = new Date(cur.y, cur.m + 1, 0).getDate();
  const iso = (d) => cur.y + '-' + String(cur.m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  const monthLabel = first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const move = (delta) => { let m = cur.m + delta, y = cur.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } setCur({ y, m }); };
  const selEvents = byDay[sel] || [];

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Calendário</h2>
        {isStudio && <button className="btn btn-ghost btn-sm" onClick={() => setAdding(!adding)}><Plus size={14} /> Novo evento</button>}
      </header>

      {adding && (
        <div className="add-stage">
          <input placeholder="Título do evento" value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} />
          <div className="add-row">
            <input type="date" value={ev.date} onChange={(e) => setEv({ ...ev, date: e.target.value })} />
            <select value={ev.kind} onChange={(e) => setEv({ ...ev, kind: e.target.value })}>
              <option value="evento">Evento</option><option value="reuniao">Reunião</option><option value="entrega">Entrega</option><option value="visita">Visita</option>
            </select>
          </div>
          <div className="row">
            <button className="btn btn-primary btn-sm" disabled={!ev.title.trim()} onClick={() => { db.addEvent(project.id, ev); setEv({ title: '', date: todayISO(), kind: 'evento' }); setAdding(false); }}>Adicionar</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="cal-head">
        <button className="icon-btn" onClick={() => move(-1)}><ChevronLeft size={16} /></button>
        <strong className="cal-month">{monthLabel}</strong>
        <button className="icon-btn" onClick={() => move(1)}><ChevronRight size={16} /></button>
      </div>
      <div className="cal-grid">
        {WEEK.map((w) => <span key={w} className="cal-wd">{w}</span>)}
        {Array.from({ length: pad }).map((_, i) => <span key={'p' + i} className="cal-cell empty-cell" />)}
        {Array.from({ length: days }).map((_, i) => {
          const d = i + 1, di = iso(d), evs = byDay[di] || [];
          return (
            <button key={d} className={'cal-cell' + (evs.length ? ' has-ev' : '') + (di === sel ? ' sel' : '') + (di === todayISO() ? ' today' : '')} onClick={() => setSel(di)}>
              <span className="cal-num">{d}</span>
              {evs.length > 0 && <span className="cal-dots">{evs.slice(0, 3).map((e, j) => <i key={j} className={'cd cd-' + e.kind} />)}</span>}
            </button>
          );
        })}
      </div>
      <div className="cal-day">
        <h4>{fmt(sel)}</h4>
        {selEvents.length === 0 ? <p className="muted-line">Sem compromissos neste dia.</p> : (
          <ul className="cal-evlist">
            {selEvents.map((e, i) => (
              <li key={i}>
                <i className={'cd cd-' + e.kind} />
                <span className="ev-main">
                  <span className="ev-title">{e.title}{e.time ? ' · ' + e.time : ''}</span>
                  {e.kind === 'reuniao' && (
                    <span className="ev-sub">
                      {e.presencial ? <span><MapPin size={11} /> Presencial</span> : <span><Video size={11} /> Online</span>}
                      {!e.presencial && e.link && <a className="ev-link" href={e.link} target="_blank" rel="noreferrer"><Link2 size={11} /> Entrar</a>}
                    </span>
                  )}
                </span>
                <em>{labelKind(e.kind)}</em>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
