import { useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, ChevronRight, X } from 'lucide-react';
import { PendenciasCtx, CHAVE_JANELA, lerVistas, marcarVistas } from '../lib/pendenciasContexto.js';
import { qk } from '../lib/data.js';
import { useResolvedDb, specsFor } from '../lib/useResolvedDb.js';

/* Etapa 7 — sino de pendências no topo de todas as telas, para o studio e
   para o cliente, e a janela que abre ao entrar enquanto houver pendências.
   Uma pendência só some da lista quando é resolvida (é calculada a partir
   dos dados). O número do sino, porém, conta só as que a pessoa ainda não
   viu: abrir o sino marca as atuais como vistas (rodada 4). A janela ao
   entrar só aparece quando há alguma nova. */
export function SinoPendencias() {
  const ctx = useContext(PendenciasCtx);
  if (!ctx) return null;
  return <Sino {...ctx} />;
}

function Sino({ baseDb, user, irPara }) {
  const r = useResolvedDb(
    baseDb,
    specsFor(baseDb, [{ key: qk.pendencias(), method: 'pendencias', args: [user.role, user.id] }]),
  );
  const lista = (r.ready && r.db.pendencias(user.role, user.id)) || [];
  const [vistas, setVistas] = useState(() => lerVistas(user.id));
  const novas = lista.filter((p) => !vistas.has(p.id));
  const marcarTodas = () => {
    const ids = lista.map((p) => p.id);
    marcarVistas(user.id, ids);
    setVistas(new Set(ids));
  };
  const [aberto, setAberto] = useState(false);
  const [janela, setJanela] = useState(() => {
    try {
      return !sessionStorage.getItem(CHAVE_JANELA);
    } catch {
      return true;
    }
  });
  const caixa = useRef(null);
  const novasAoAbrir = useRef(new Set());
  if (!aberto) novasAoAbrir.current = new Set(novas.map((p) => p.id));

  const fecharJanela = () => {
    setJanela(false);
    marcarTodas();
    try {
      sessionStorage.setItem(CHAVE_JANELA, '1');
    } catch {
      /* ignora */
    }
  };
  const ir = (p) => {
    setAberto(false);
    fecharJanela();
    irPara(p.pid, p.aba, p.alvo);
  };
  const abrirSino = () => {
    if (!aberto) marcarTodas();
    setAberto(!aberto);
  };

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

  const n = novas.length;
  return (
    <div className="sino" ref={caixa}>
      <button
        type="button"
        className="icon-btn sino-btn"
        aria-label={
          n ? n + (n === 1 ? ' pendência nova' : ' pendências novas') : lista.length ? 'Pendências' : 'Pendências (nenhuma)'
        }
        aria-expanded={aberto}
        onClick={abrirSino}
      >
        <Bell size={17} />
        {n > 0 && <span className="sino-n">{n > 9 ? '9+' : n}</span>}
      </button>
      {aberto && (
        <div className="sino-painel" role="dialog" aria-label="Pendências">
          <ListaPendencias lista={lista} novas={novasAoAbrir.current} vazio="Nenhuma pendência. Está tudo em dia." onIr={ir} />
        </div>
      )}
      {janela && n > 0 && (
        <JanelaPendencias
          lista={novas}
          studio={user.role === 'studio'}
          onIr={ir}
          onFechar={fecharJanela}
        />
      )}
    </div>
  );
}

function ListaPendencias({ lista, vazio, onIr, novas = null }) {
  if (!lista.length) return <p className="sino-vazio">{vazio}</p>;
  // agrupa por projeto (o cliente costuma ter um; o studio, vários)
  const grupos = [];
  for (const p of lista) {
    let g = grupos.find((x) => x.pid === p.pid);
    if (!g) grupos.push((g = { pid: p.pid, projeto: p.projeto, itens: [] }));
    g.itens.push(p);
  }
  return grupos.map((g) => (
    <div key={g.pid} className="sino-grupo">
      {grupos.length > 1 && <h4>{g.projeto}</h4>}
      <ul>
        {g.itens.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onIr(p)} className={novas && novas.has(p.id) ? 'sino-nova' : undefined}>
              <span>{p.texto}</span>
              <ChevronRight size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  ));
}

function JanelaPendencias({ lista, studio, onIr, onFechar }) {
  const fechar = useRef(null);
  useEffect(() => {
    if (fechar.current) fechar.current.focus();
    const esc = (e) => e.key === 'Escape' && onFechar();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onFechar]);
  const n = lista.length;
  // fora do cabeçalho (que cria seu próprio contexto de posição), dentro da
  // raiz .cp para manter os estilos
  const raiz = document.querySelector('.cp') || document.body;
  return createPortal(
    <div className="janela-fundo" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="janela" role="dialog" aria-modal="true" aria-labelledby="janela-titulo">
        <header>
          <h2 id="janela-titulo">
            {studio
              ? n === 1
                ? 'Há 1 pendência esperando você'
                : 'Há ' + n + ' pendências esperando você'
              : n === 1
                ? 'Você tem 1 pendência no projeto'
                : 'Você tem ' + n + ' pendências no projeto'}
          </h2>
          <button
            type="button"
            className="icon-btn"
            aria-label="Fechar"
            ref={fechar}
            onClick={onFechar}
          >
            <X size={16} />
          </button>
        </header>
        <div className="janela-corpo">
          <ListaPendencias lista={lista} onIr={onIr} />
        </div>
        <footer>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onFechar}>
            Ver depois
          </button>
        </footer>
      </div>
    </div>,
    raiz,
  );
}
