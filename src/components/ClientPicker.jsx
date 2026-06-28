import { Hash, MapPin, ChevronRight } from 'lucide-react';
import { TopBar } from './atoms.jsx';

export function ClientPicker({ db, user, onLogout, onOpen }) {
  const projects = db.projectsForClient(user.id);
  return (
    <div className="shell">
      <TopBar user={user} onLogout={onLogout} />
      <main className="content">
        <div className="hero"><span className="hero-tag">Seus projetos</span><h1 className="hero-name">Olá, {user.name}</h1></div>
        <div className="proj-grid">
          {projects.map((p) => (
            <button key={p.id} className="proj-card" onClick={() => onOpen(p.id)}>
              <div className="proj-top"><span className="proj-code"><Hash size={11} /> {p.code}</span></div>
              <h3>{p.name}</h3><p className="proj-addr"><MapPin size={12} /> {p.address}</p>
              <div className="proj-foot"><span /><span className="open">Abrir <ChevronRight size={14} /></span></div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
