import { useState, useRef, useEffect } from 'react';
import { SinoPendencias } from './Pendencias.jsx';
import { erroAmigavel } from '../lib/erros.js';
import {
  Check,
  CircleDot,
  CircleDashed,
  Building2,
  LogOut,
  Loader2,
  AlertTriangle,
  X,
  MoreHorizontal,
} from 'lucide-react';
import { LOCKUP, STUDIO } from '../lib/constants.js';

export function Loading({ text = 'Carregando…' }) {
  return (
    <div className="empty">
      <Loader2 size={18} className="spin" />
      <span>{text}</span>
    </div>
  );
}

export function ErrorBox({ text, error, onRetry }) {
  // A frase principal é sempre humana; a causa real fica recolhida em
  // "Detalhe técnico" — útil para diagnosticar, sem assustar o cliente.
  const amigavel = error ? erroAmigavel(error) : null;
  const principal = text || (amigavel ? amigavel.texto : 'Não foi possível carregar os dados.');
  return (
    <div className="empty">
      <AlertTriangle size={18} />
      <span>{principal}</span>
      {amigavel && amigavel.detalhe && (
        <details className="detalhe-tecnico">
          <summary>Detalhe técnico</summary>
          <span>{amigavel.detalhe}</span>
        </details>
      )}
      {onRetry && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry} style={{ marginTop: 8 }}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function ErrorBanner({ error, onClose }) {
  if (!error) return null;
  const amigavel = erroAmigavel(error);
  return (
    <div className="alert" role="alert">
      <AlertTriangle size={16} />
      <span>
        {amigavel.texto}
        {amigavel.detalhe && (
          <details className="detalhe-tecnico">
            <summary>Detalhe técnico</summary>
            <span>{amigavel.detalhe}</span>
          </details>
        )}
      </span>
      {onClose && (
        <button
          className="icon-btn"
          title="Fechar"
          onClick={onClose}
          style={{ marginLeft: 'auto' }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function Mark({ small }) {
  // Logo oficial da marca (arquivo da identidade), nunca remontado em texto:
  // a versão anterior digitava o nome em outra fonte ao lado do monograma.
  return (
    <div className={'mark' + (small ? ' mark-sm' : '')}>
      <img src={LOCKUP} alt={STUDIO.name + ' — ' + STUDIO.tagline} className="mark-lockup" />
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

/* Esqueleto de carregamento (rodada 10): o desenho da tela em tons claros
   enquanto os dados chegam, no lugar da tela em branco com "Carregando…". */
export function Esqueleto({ abas = true }) {
  return (
    <div className="esq" aria-busy="true" aria-label="Carregando">
      <div className="esq-hero">
        <span className="esq-l esq-w20" />
        <span className="esq-l esq-titulo esq-w50" />
        <span className="esq-l esq-w40" />
        <span className="esq-l esq-w30" />
      </div>
      {abas && (
        <div className="esq-abas">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="esq-l esq-aba" />
          ))}
        </div>
      )}
      <div className="esq-painel">
        {[70, 55, 62].map((w, i) => (
          <div key={i} className="esq-linha">
            <span className="esq-bola" />
            <span className="esq-l" style={{ width: w + '%' }} />
          </div>
        ))}
      </div>
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
        <SinoPendencias />
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

/* Menu "⋯" (rodada 10): ações menos usadas (editar, excluir) num menu, em
   vez de botões fixos em cada item. itens: [{ rotulo, Icone, acao, perigo }] */
export function MenuMais({ itens, rotulo = 'Mais ações' }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef(null);
  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => caixa.current && !caixa.current.contains(e.target) && setAberto(false);
    const esc = (e) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);
  return (
    <div className="menu-mais" ref={caixa}>
      <button
        type="button"
        className="icon-btn menu-mais-btn"
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto(!aberto)}
      >
        <MoreHorizontal size={16} />
      </button>
      {aberto && (
        <ul className="menu-mais-lista" role="menu">
          {itens.map(({ rotulo: r, Icone, acao, perigo }) => (
            <li key={r} role="none">
              <button
                type="button"
                role="menuitem"
                className={perigo ? 'perigo' : undefined}
                onClick={() => {
                  setAberto(false);
                  acao();
                }}
              >
                {Icone && <Icone size={14} />} {r}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* Status como seletor no próprio balão (rodada 10, studio) */
export function StatusSelect({ status, onChange, opcoes }) {
  const cls = { concluida: 'pill-done', em_andamento: 'pill-now', a_fazer: 'pill-next' }[status] || 'pill-next';
  return (
    <label className={'pill pill-select ' + cls}>
      <span className="sr-only">Status da etapa</span>
      <select value={status} onChange={(e) => onChange(e.target.value)} aria-label="Status da etapa">
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
