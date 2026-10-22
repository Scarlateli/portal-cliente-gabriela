/* Contexto dos avisos (ver components/Avisos.jsx). Fora do provedor
   (testes de componente), exclui direto e não avisa. */
import { createContext, useContext } from 'react';

export const AvisosCtx = createContext(null);
const SEM_PROVEDOR = {
  avisar: () => {},
  excluirComDesfazer: ({ executar }) => executar(),
  ocultos: new Set(),
};
export const useAvisos = () => useContext(AvisosCtx) || SEM_PROVEDOR;
