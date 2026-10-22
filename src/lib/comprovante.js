/* Comprovante em PDF de um termo/contrato aprovado (ou assinado) pelo
   cliente no portal (rodada 7, pedido da Gabriela). Gerado no navegador,
   com a biblioteca carregada só na hora do clique. */
import { enderecoCurto } from './endereco.js';
import { metodoDe } from './contratos.js';

const FUSO = 'America/Sao_Paulo';

// "20/10/2026" e "14:32" no horário de Brasília
export function dataHoraBR(valor) {
  if (!valor) return { data: '', hora: '' };
  const s = String(valor);
  // só a data (sem horário): não inventa hora
  if (/^\d{4}-\d{2}-\d{2}$/.test(s))
    return { data: s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4), hora: '' };
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return { data: '', hora: '' };
  const data = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
  const hora = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return { data, hora };
}

/* Os textos do comprovante, separados do desenho do PDF (fáceis de testar
   e de ajustar a redação). */
export function textosComprovante({
  contrato: c,
  projeto: p = {},
  cliente = '',
  agora = new Date(),
}) {
  const assinatura = metodoDe(c) === 'portal';
  const daEtapa = !!c.stageId; // gerado quando o cliente aprovou a etapa (rodada 11)
  const tipo = c.kind === 'contrato' ? 'Contrato' : 'Termo';
  const quem = (c.signer || cliente || '').trim();
  const { data, hora } = dataHoraBR(c.respondedAt || c.signedAt);
  const gerado = dataHoraBR(agora.toISOString());
  const quando = data
    ? ' em ' + data + (hora ? ', às ' + hora + ' (horário de Brasília)' : '')
    : '';
  return {
    titulo: assinatura
      ? 'Comprovante de assinatura'
      : daEtapa
        ? 'Comprovante de aprovação de etapa'
        : 'Comprovante de aprovação',
    campos: [
      ['Documento', c.name || tipo],
      ['Tipo', tipo],
      ['Projeto', [p.code, p.name].filter(Boolean).join(' · ')],
      ['Endereço', enderecoCurto(p)],
      ['Cliente', cliente],
      ['Comentário', daEtapa ? c.responseNote || '' : ''],
    ].filter(([, v]) => v),
    corpo: String(c.body || '').trim(),
    declaracao:
      (assinatura ? 'Assinado eletronicamente por ' : 'Aprovado por ') +
      quem +
      quando +
      (daEtapa
        ? ', na Linha do Tempo do Portal do Cliente Gabriela Lendecker (portal.gabrielalendecker.com), com o acesso pessoal do cliente, digitando o nome completo e confirmando a aprovação da etapa.'
        : ', por meio do Portal do Cliente Gabriela Lendecker (portal.gabrielalendecker.com), com o acesso pessoal do cliente' +
          (assinatura ? ', digitando o nome completo e confirmando a assinatura.' : ', pelo botão "Aprovar" do documento.')),
    rodape:
      'Comprovante gerado em ' +
      gerado.data +
      ', às ' +
      gerado.hora +
      '. Código do documento no portal: ' +
      c.id +
      '.',
  };
}

// A fonte padrão do PDF não tem todos os caracteres; troca os que faltam.
const EXTRAS = '–—‘’“”•…€';
const limpar = (t) =>
  String(t || '')
    .normalize('NFC')
    .replace(/\t/g, '  ')
    .split('')
    .map((ch) =>
      ch === '\n' || (ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 256) || EXTRAS.includes(ch)
        ? ch
        : '?',
    )
    .join('');

function quebrar(texto, fonte, tam, largura) {
  const linhas = [];
  limpar(texto)
    .split('\n')
    .forEach((par) => {
      const palavras = par.split(/\s+/).filter(Boolean);
      if (!palavras.length) {
        linhas.push('');
        return;
      }
      let atual = '';
      palavras.forEach((w) => {
        const tenta = atual ? atual + ' ' + w : w;
        if (fonte.widthOfTextAtSize(tenta, tam) <= largura) atual = tenta;
        else {
          if (atual) linhas.push(atual);
          atual = w;
        }
      });
      linhas.push(atual);
    });
  return linhas;
}

export async function gerarComprovantePdf(dados) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const t = textosComprovante(dados);
  const pdf = await PDFDocument.create();
  pdf.setTitle(t.titulo + ' - ' + (dados.contrato.name || ''));
  pdf.setAuthor('Gabriela Lendecker Arquitetura e Interiores');
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const tinta = rgb(33 / 255, 9 / 255, 9 / 255);
  const suave = rgb(0.42, 0.36, 0.35);
  const linhaCor = rgb(0.85, 0.82, 0.78);
  const W = 595.28;
  const H = 841.89;
  const M = 56;
  const larg = W - 2 * M;
  let page = pdf.addPage([W, H]);
  let y = H - M;

  const novaPagina = () => {
    page = pdf.addPage([W, H]);
    y = H - M;
  };
  const escrever = (
    texto,
    { fonte = normal, tam = 10.5, cor = tinta, x = M, largura = larg, entre = 4 } = {},
  ) => {
    quebrar(texto, fonte, tam, largura).forEach((l) => {
      if (y < M + 40) novaPagina();
      page.drawText(l, { x, y: y - tam, size: tam, font: fonte, color: cor });
      y -= tam + entre;
    });
  };

  // logo (se não carregar, segue só com o texto)
  try {
    const resp = await fetch('/brand/lockup.png');
    if (resp.ok) {
      const img = await pdf.embedPng(await resp.arrayBuffer());
      const w = 170;
      const h = (img.height / img.width) * w;
      page.drawImage(img, { x: (W - w) / 2, y: y - h, width: w, height: h });
      y -= h + 22;
    }
  } catch {
    escrever('GABRIELA LENDECKER · arquitetura e interiores', { fonte: negrito, tam: 12 });
    y -= 10;
  }
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: linhaCor });
  y -= 26;

  escrever(t.titulo, { fonte: negrito, tam: 16, entre: 6 });
  y -= 10;

  t.campos.forEach(([rot, val]) => {
    if (y < M + 40) novaPagina();
    page.drawText(limpar(rot), { x: M, y: y - 10, size: 9, font: negrito, color: suave });
    const antes = y;
    escrever(val, { x: M + 78, largura: larg - 78, tam: 10.5 });
    if (y === antes) y -= 14;
    y -= 3;
  });
  y -= 12;

  if (t.corpo) {
    escrever('Texto do documento', { fonte: negrito, tam: 9, cor: suave });
    y -= 4;
    const topo = y;
    escrever(t.corpo, { x: M + 12, largura: larg - 12, tam: 10.5, entre: 5 });
    page.drawLine({
      start: { x: M + 2, y: topo },
      end: { x: M + 2, y: y + 4 },
      thickness: 1.5,
      color: linhaCor,
    });
    y -= 18;
  }

  // declaração em destaque, numa caixa
  const linhas = quebrar(t.declaracao, normal, 10.5, larg - 28);
  const alturaCaixa = linhas.length * 15 + 26;
  if (y - alturaCaixa < M + 40) novaPagina();
  page.drawRectangle({
    x: M,
    y: y - alturaCaixa,
    width: larg,
    height: alturaCaixa,
    borderColor: linhaCor,
    borderWidth: 0.8,
    color: rgb(0.984, 0.98, 0.973),
  });
  y -= 15;
  linhas.forEach((l) => {
    page.drawText(l, { x: M + 14, y: y - 10.5, size: 10.5, font: normal, color: tinta });
    y -= 15;
  });
  y -= 20;

  // rodapé em todas as páginas
  pdf.getPages().forEach((pg, i, todas) => {
    quebrar(
      t.rodape + (todas.length > 1 ? ' Página ' + (i + 1) + ' de ' + todas.length + '.' : ''),
      normal,
      8,
      larg,
    ).forEach((l, j) =>
      pg.drawText(l, { x: M, y: 34 - j * 10, size: 8, font: normal, color: suave }),
    );
  });

  return pdf.save();
}

// entrega um arquivo gerado no navegador como download
export function baixarBlob(bytes, nome, tipo) {
  const url = URL.createObjectURL(
    bytes instanceof Blob ? bytes : new Blob([bytes], { type: tipo }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const nomeArquivo = (t) =>
  String(t || 'documento')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'documento';
