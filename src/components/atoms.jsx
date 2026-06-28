import { Check, CircleDot, CircleDashed, Building2, LogOut } from 'lucide-react';
import { LOGO, STUDIO } from '../lib/constants.js';

export function Mark({ small }) {
  return (
    <div className={'mark' + (small ? ' mark-sm' : '')}>
      <img src={LOGO} alt={STUDIO.name} className="mark-logo" />
      <span className="mark-text">
        <strong>{STUDIO.name}</strong>
        {!small && <em>{STUDIO.tagline}</em>}
      </span>
    </div>
  );
}

export function StatusPill({ status }) {
  const map = {
    concluida: ['pill-done', Check, 'Concluída'],
    em_andamento: ['pill-now', CircleDot, 'Em andamento'],
    a_fazer: ['pill-next', CircleDashed, 'A fazer'],
  };
  const [c, I, t] = map[status] || map.a_fazer;
  return (
    <span className={'pill ' + c}>
      <I size={12} /> {t}
    </span>
  );
}

export function Empty({ text }) {
  return (
    <div className="empty">
      <CircleDashed size={18} />
      <span>{text}</span>
    </div>
  );
}

export function TopBar({ user, onLogout, left, right }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        {left}
        <Mark small />
      </div>
      <div className="topbar-right">
        {right}
        {user.role === 'studio' && (
          <span className="badge">
            <Building2 size={12} /> Studio
          </span>
        )}
        <div className="who">
          <span className="avatar">{user.name[0]}</span>
          <span className="who-name">{user.name}</span>
        </div>
        <button className="icon-btn" title="Sair" onClick={onLogout}>
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
