/* Etapas e sub-etapas: formatos e valores compartilhados pelo editor de
   etapas (templates e novo projeto). */
import { STAGE_CATEGORIES } from './constants.js';

export const SUB_TIPOS = [
  ['tarefa', 'Tarefa'],
  ['reuniao', 'Reunião'],
  ['entrega', 'Entrega'],
];
export const SUB_RESPONSAVEIS = [
  ['studio', 'Studio'],
  ['cliente', 'Cliente'],
  ['fornecedor', 'Fornecedor'],
];

export const etapaVazia = () => ({ title: '', category: STAGE_CATEGORIES[0], desc: '', subs: [] });
export const subVazia = () => ({ title: '', kind: 'tarefa', responsible: 'studio' });

// cópia profunda, para editar sem alterar o template original
export const copiarItens = (itens) =>
  (itens || []).map((it) => ({ ...it, subs: (it.subs || []).map((b) => ({ ...b })) }));
