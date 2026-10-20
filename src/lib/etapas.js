/* Etapas e sub-etapas: formatos e valores compartilhados pelo editor de
   etapas (templates e novo projeto) e pela linha do tempo. */
import { STAGE_CATEGORIES } from './constants.js';
import { todayISO } from './helpers.js';

// Os mesmos tipos das etapas, mais "Tarefa"; "Outro" deixa escrever o nome.
export const SUB_TIPOS = [
  ['tarefa', 'Tarefa'],
  ['reuniao', 'Reunião'],
  ['entrega', 'Entrega'],
  ['visita', 'Visita técnica'],
  ['documentacao', 'Documentação'],
  ['producao', 'Produção'],
  ['outro', 'Outro (escrever)'],
];
const ROTULO_TIPO = Object.fromEntries(SUB_TIPOS.map(([v, r]) => [v, v === 'outro' ? 'Outro' : r]));

export const SUB_RESPONSAVEIS = [
  ['studio', 'Studio'],
  ['cliente', 'Cliente'],
  ['fornecedor', 'Fornecedor'],
];
export const ROTULO_RESP = Object.fromEntries(SUB_RESPONSAVEIS);

// Tipos que acontecem num dia marcado (data + horário), não "até" um prazo.
export const SUB_COM_HORARIO = ['reuniao', 'visita'];

export const rotuloTipoSub = (b) =>
  b.kind === 'outro' ? (b.kindLabel || '').trim() || 'Outro' : ROTULO_TIPO[b.kind] || 'Tarefa';

export const etapaVazia = () => ({ title: '', category: STAGE_CATEGORIES[0], desc: '', subs: [] });
export const subVazia = () => ({ title: '', kind: 'tarefa', kindLabel: '', responsible: 'studio' });
export const subCompletaVazia = () => ({
  ...subVazia(),
  due: '',
  time: '',
  format: 'online',
  link: '',
});

// cópia profunda, para editar sem alterar o template original
export const copiarItens = (itens) =>
  (itens || []).map((it) => ({ ...it, subs: (it.subs || []).map((b) => ({ ...b })) }));

// Troca o item i de lugar com o vizinho (d = -1 sobe, +1 desce).
export const moverNaLista = (lista, i, d) => {
  const j = i + d;
  if (j < 0 || j >= lista.length) return lista;
  const nova = lista.slice();
  [nova[i], nova[j]] = [nova[j], nova[i]];
  return nova;
};

/* Situação do prazo de uma sub-etapa, para a linha do tempo dizer com
   clareza se há prazo, qual é e se está atrasado.
   estado: 'feito' | 'sem' | 'ok' | 'hoje' | 'atrasado' */
const dataBR = (iso) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');
export function prazoSub(b, hoje = todayISO()) {
  const marcado = SUB_COM_HORARIO.includes(b.kind);
  if (!b.due) return { estado: b.done ? 'feito' : 'sem', texto: marcado ? 'Sem data' : 'Sem prazo' };
  const quando = marcado
    ? dataBR(b.due) + (b.time ? ' às ' + b.time : '') + (b.kind === 'reuniao' ? (b.format === 'presencial' ? ' · presencial' : ' · online') : '')
    : 'Até ' + dataBR(b.due);
  if (b.done) return { estado: 'feito', texto: quando };
  if (b.due < hoje)
    return { estado: 'atrasado', texto: marcado ? 'Data passou: ' + quando : 'Atrasada · venceu ' + dataBR(b.due) };
  if (b.due === hoje) return { estado: 'hoje', texto: marcado ? 'Hoje' + (b.time ? ' às ' + b.time : '') : 'Vence hoje' };
  return { estado: 'ok', texto: quando };
}

/* Coluna da direita na lista de sub-etapas (rodada 6, desenho da
   Gabriela): a data em destaque ("Hoje", "Amanhã", "Até 30/10") e, embaixo,
   o horário quando é reunião ou visita. null quando não há o que mostrar.
   estado: 'feito' | 'ok' | 'hoje' | 'atrasado' */
export function quandoSub(b, hoje = todayISO()) {
  if (b.done) return { estado: 'feito', data: 'Concluída', hora: '' };
  if (!b.due) return null;
  const marcado = SUB_COM_HORARIO.includes(b.kind);
  const ddmm = b.due.slice(8, 10) + '/' + b.due.slice(5, 7) + (b.due.slice(0, 4) !== hoje.slice(0, 4) ? '/' + b.due.slice(2, 4) : '');
  const d = new Date(hoje + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  const amanha = d.toISOString().slice(0, 10);
  const hora = marcado && b.time ? b.time : '';
  if (b.due < hoje) return { estado: 'atrasado', data: marcado ? ddmm : 'Venceu ' + ddmm, hora };
  if (b.due === hoje) return { estado: 'hoje', data: 'Hoje', hora };
  if (b.due === amanha) return { estado: 'ok', data: 'Amanhã', hora };
  return { estado: 'ok', data: marcado ? ddmm : 'Até ' + ddmm, hora };
}
