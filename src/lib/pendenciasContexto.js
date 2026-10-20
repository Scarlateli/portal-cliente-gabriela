import { createContext } from 'react';

/* Quem está logado, o banco e como navegar até uma pendência (projeto, aba
   e o item dentro da aba). Fornecido pelo App; o sino no topo lê daqui. */
export const PendenciasCtx = createContext(null);

const CHAVE_ABA = 'gl-aba-pedida';
export const CHAVE_JANELA = 'gl-pendencias-vistas';

// Pendências já vistas no sino, por pessoa e por aparelho. O número do sino
// conta só as novas; a lista continua mostrando todas até serem resolvidas.
const chaveVistas = (uid) => 'gl-pend-vistas:' + uid;
export function lerVistas(uid) {
  try {
    return new Set(JSON.parse(localStorage.getItem(chaveVistas(uid)) || '[]'));
  } catch {
    return new Set();
  }
}
export function marcarVistas(uid, ids) {
  try {
    localStorage.setItem(chaveVistas(uid), JSON.stringify([...new Set(ids)].slice(-300)));
  } catch {
    /* sem armazenamento: o sino volta a contar tudo no próximo acesso */
  }
}

export function pedirAba(pid, aba, alvo = null) {
  try {
    sessionStorage.setItem(CHAVE_ABA, JSON.stringify({ pid, aba, alvo }));
  } catch {
    /* sem armazenamento: o evento abaixo ainda troca a aba */
  }
  window.dispatchEvent(new CustomEvent('gl-ir-aba', { detail: { pid, aba, alvo } }));
}

// o pedido vale uma vez, para o projeto que foi aberto: { aba, alvo } ou null
export function consumirPedido(pid) {
  try {
    const v = JSON.parse(sessionStorage.getItem(CHAVE_ABA) || 'null');
    if (v && v.pid === pid) {
      sessionStorage.removeItem(CHAVE_ABA);
      return { aba: v.aba, alvo: v.alvo || null };
    }
  } catch {
    /* ignora */
  }
  return null;
}
export const consumirAba = (pid) => {
  const p = consumirPedido(pid);
  return p ? p.aba : null;
};

/* Rola até o item (id "alvo-…") e o destaca por um instante. Tenta por
   alguns décimos de segundo porque a aba pode estar acabando de abrir. */
export function destacarAlvo(alvo) {
  if (!alvo) return () => {};
  let vezes = 0;
  let timer = null;
  const tentar = () => {
    const el = document.getElementById('alvo-' + alvo);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('destaque');
      timer = setTimeout(() => el.classList.remove('destaque'), 2600);
      return;
    }
    if (++vezes < 25) timer = setTimeout(tentar, 80);
  };
  timer = setTimeout(tentar, 60);
  return () => clearTimeout(timer);
}
