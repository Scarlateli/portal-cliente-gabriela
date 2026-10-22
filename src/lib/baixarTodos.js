/* "Baixar todos" de um pedido de arquivos (rodada 7): junta os arquivos
   num .zip no navegador. A biblioteca só carrega na hora do clique. */
import { baixarBlob, nomeArquivo } from './comprovante.js';

// nomes repetidos viram "foto (2).jpg"
export function nomesUnicos(nomes) {
  const vistos = new Map();
  return nomes.map((n) => {
    const base = String(n || 'arquivo');
    const k = base.toLowerCase();
    const c = (vistos.get(k) || 0) + 1;
    vistos.set(k, c);
    if (c === 1) return base;
    const i = base.lastIndexOf('.');
    return i > 0 ? base.slice(0, i) + ' (' + c + ')' + base.slice(i) : base + ' (' + c + ')';
  });
}

export async function baixarTodos(db, arquivos, titulo, aoProgredir = () => {}) {
  const { zipSync } = await import('fflate');
  const lista = arquivos.filter((a) => a.storagePath);
  const nomes = nomesUnicos(lista.map((a) => a.name));
  const conteudo = {};
  for (let i = 0; i < lista.length; i++) {
    aoProgredir(i + 1, lista.length);
    const url = await db.fileUrl(lista[i].storagePath);
    if (!url) throw new Error('Não foi possível abrir "' + lista[i].name + '".');
    const r = await fetch(url);
    if (!r.ok) throw new Error('Não foi possível baixar "' + lista[i].name + '".');
    conteudo[nomes[i]] = [new Uint8Array(await r.arrayBuffer()), { level: 0 }];
  }
  // fotos e PDFs já vêm comprimidos: guardar sem recomprimir é mais rápido
  baixarBlob(zipSync(conteudo), nomeArquivo(titulo) + '.zip', 'application/zip');
}
