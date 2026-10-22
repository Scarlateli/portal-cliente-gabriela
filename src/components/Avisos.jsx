/* Avisos discretos no canto da tela (rodada 10):
   - avisar('Documento enviado'): confirmação de que deu certo;
   - excluirComDesfazer({ id, texto, executar }): o item some na hora e o
     aviso oferece "Desfazer" por alguns segundos; só depois a exclusão vai
     para o banco. Substitui a janela "Tem certeza?" do navegador.
   Ao sair da página com uma exclusão pendente, ela é feita na hora. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Undo2, X } from 'lucide-react';
import { AvisosCtx } from '../lib/avisosContexto.js';

const ESPERA = 6000;

export function AvisosProvider({ children }) {
  const [avisos, setAvisos] = useState([]);
  const [ocultos, setOcultos] = useState(() => new Set());
  const pendentes = useRef(new Map()); // id -> { executar, timer }

  const tirar = useCallback((chave) => setAvisos((l) => l.filter((a) => a.chave !== chave)), []);

  const avisar = useCallback(
    (texto) => {
      const chave = Math.random().toString(36).slice(2);
      setAvisos((l) => [...l.slice(-2), { chave, texto }]);
      setTimeout(() => tirar(chave), 3500);
    },
    [tirar],
  );

  const concluir = useCallback((id) => {
    const p = pendentes.current.get(id);
    if (!p) return;
    pendentes.current.delete(id);
    clearTimeout(p.timer);
    Promise.resolve()
      .then(p.executar)
      .catch(() => {})
      .finally(() =>
        setOcultos((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        }),
      );
  }, []);

  const excluirComDesfazer = useCallback(
    ({ id, texto, executar }) => {
      const chave = 'del-' + id;
      setOcultos((s) => new Set(s).add(id));
      const timer = setTimeout(() => {
        tirar(chave);
        concluir(id);
      }, ESPERA);
      pendentes.current.set(id, { executar, timer });
      const desfazer = () => {
        const p = pendentes.current.get(id);
        if (p) clearTimeout(p.timer);
        pendentes.current.delete(id);
        setOcultos((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
        tirar(chave);
      };
      setAvisos((l) => [...l.filter((a) => a.chave !== chave).slice(-2), { chave, texto, desfazer }]);
    },
    [tirar, concluir],
  );

  // saindo da página ou trocando de tela: faz o que estava pendente
  useEffect(() => {
    const tudo = () => [...pendentes.current.keys()].forEach(concluir);
    window.addEventListener('pagehide', tudo);
    return () => {
      window.removeEventListener('pagehide', tudo);
      tudo();
    };
  }, [concluir]);

  const valor = useMemo(() => ({ avisar, excluirComDesfazer, ocultos }), [avisar, excluirComDesfazer, ocultos]);
  return (
    <AvisosCtx.Provider value={valor}>
      {children}
      <div className="avisos" role="status" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.chave} className="aviso">
            {!a.desfazer && <Check size={15} aria-hidden />}
            <span>{a.texto}</span>
            {a.desfazer && (
              <button type="button" className="aviso-desfazer" onClick={a.desfazer}>
                <Undo2 size={14} /> Desfazer
              </button>
            )}
            <button type="button" className="aviso-fechar" aria-label="Fechar aviso" onClick={() => (a.desfazer ? (tirar(a.chave), concluir(a.chave.slice(4))) : tirar(a.chave))}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </AvisosCtx.Provider>
  );
}
