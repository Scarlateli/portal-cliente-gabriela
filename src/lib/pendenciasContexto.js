import { createContext } from 'react';

/* Quem está logado, o banco e como navegar até uma pendência (projeto + aba).
   Fornecido pelo App; o sino no topo de cada tela lê daqui. */
export const PendenciasCtx = createContext(null);

const CHAVE_ABA = 'gl-aba-pedida';
export const CHAVE_JANELA = 'gl-pendencias-vistas';

export function pedirAba(pid, aba) {
  try {
    sessionStorage.setItem(CHAVE_ABA, JSON.stringify({ pid, aba }));
  } catch {
    /* sem armazenamento: o evento abaixo ainda troca a aba */
  }
  window.dispatchEvent(new CustomEvent('gl-ir-aba', { detail: { pid, aba } }));
}

// a aba pedida vale uma vez, para o projeto que foi aberto
export function consumirAba(pid) {
  try {
    const v = JSON.parse(sessionStorage.getItem(CHAVE_ABA) || 'null');
    if (v && v.pid === pid) {
      sessionStorage.removeItem(CHAVE_ABA);
      return v.aba;
    }
  } catch {
    /* ignora */
  }
  return null;
}
