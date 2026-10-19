import { Hash, MapPin, ChevronRight } from 'lucide-react';
import { TopBar } from './atoms.jsx';
import { enderecoCurto, vocativo } from '../lib/endereco.js';

export function ClientPicker({ user, projects = [], onLogout, onOpen }) {
  // um vocativo só quando todos os projetos usam o mesmo; senão, o nome
  const vocs = [...new Set(projects.map((p) => (p.greeting || '').trim()).filter(Boolean))];
  const saudacao = vocs.length === 1 ? vocs[0] : vocativo('', user.name) || user.name;
  return (
    <div className="shell">
      <TopBar user={user} onLogout={onLogout} />
      <main className="content">
        <div className="hero">
          <span className="hero-tag">Seus projetos</span>
          <h1 className="hero-name">Olá, {saudacao}</h1>
        </div>
        <div className="proj-grid">
          {projects.map((p) => (
            <button key={p.id} className="proj-card" onClick={() => onOpen(p.id)}>
              <div className="proj-top">
                <span className="proj-code">
                  <Hash size={11} /> {p.code}
                </span>
              </div>
              <h3>{p.name}</h3>
              {enderecoCurto(p) && (
                <p className="proj-addr">
                  <MapPin size={12} /> {enderecoCurto(p)}
                </p>
              )}
              <div className="proj-foot">
                <span />
                <span className="open">
                  Abrir <ChevronRight size={14} />
                </span>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
