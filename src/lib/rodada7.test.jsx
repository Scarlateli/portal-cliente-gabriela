/* Rodada 7 (visão do studio, 22/10): comprovante em PDF do termo aprovado,
   "Baixar todos" nos envios do cliente e lista de arquivos curta. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { unzipSync, strFromU8 } from 'fflate';
import { textosComprovante, dataHoraBR, gerarComprovantePdf, nomeArquivo } from './comprovante.js';
import { nomesUnicos, baixarTodos } from './baixarTodos.js';
import { Contract } from '../components/project/Contract.jsx';
import { EnviosCliente } from '../components/project/EnviosCliente.jsx';

afterEach(() => vi.unstubAllGlobals());

const termo = {
  id: 'c1', projectId: 'p1', kind: 'termo', method: 'aceite', name: 'Termo de Finalização - Briefing',
  body: 'O cliente declara finalizada e aprovada a etapa de Briefing.', sigStatus: 'assinado', provider: 'Portal',
  signer: 'Maria Silva', signedAt: '2026-10-20', respondedAt: '2026-10-20T17:32:00Z',
};
const projeto = { code: '0000', name: 'CASA TESTE', address: 'Rua do Teste, 123', city: 'São Paulo', state: 'SP' };

describe('comprovante do termo', () => {
  it('data e hora no horário de Brasília', () => {
    expect(dataHoraBR('2026-10-20T17:32:00Z')).toEqual({ data: '20/10/2026', hora: '14:32' });
    expect(dataHoraBR('2026-10-20')).toEqual({ data: '20/10/2026', hora: '' });
  });

  it('diz quem aprovou, quando e como', () => {
    const t = textosComprovante({ contrato: termo, projeto, cliente: 'Maria Silva' });
    expect(t.titulo).toBe('Comprovante de aprovação');
    expect(t.declaracao).toMatch(/^Aprovado por Maria Silva em 20\/10\/2026, às 14:32 \(horário de Brasília\)/);
    expect(t.declaracao).toMatch(/Portal do Cliente Gabriela Lendecker/);
    expect(t.declaracao).toMatch(/botão "Aprovar"/);
    expect(t.campos).toContainEqual(['Projeto', '0000 · CASA TESTE']);
    expect(t.rodape).toMatch(/c1/);
  });

  it('assinatura no portal fala em nome digitado', () => {
    const t = textosComprovante({ contrato: { ...termo, kind: 'contrato', method: 'portal' }, projeto, cliente: 'Maria Silva' });
    expect(t.titulo).toBe('Comprovante de assinatura');
    expect(t.declaracao).toMatch(/^Assinado eletronicamente por Maria Silva/);
    expect(t.declaracao).toMatch(/digitando o nome completo/);
  });

  it('gera um PDF de verdade (mesmo sem o logo)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    const bytes = await gerarComprovantePdf({ contrato: { ...termo, body: 'Linha com emoji 🙂 e acentuação' }, projeto, cliente: 'Maria Silva' });
    expect(strFromU8(bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('botão só para o que foi aprovado ou assinado no portal', () => {
    const autentique = { ...termo, id: 'c2', kind: 'contrato', method: 'autentique', name: 'Contrato' };
    const pendente = { ...termo, id: 'c3', sigStatus: 'enviado', name: 'Outro termo' };
    const db = { contracts: () => [termo, autentique, pendente], clientName: () => 'Maria Silva', checkAutentique: () => {} };
    render(<Contract db={db} project={{ id: 'p1', ...projeto }} isStudio />);
    expect(screen.getAllByRole('button', { name: /Baixar comprovante/ })).toHaveLength(1);
  });

  it('nome de arquivo sem acentos nem símbolos', () => {
    expect(nomeArquivo('Termo de Finalização - Briefing')).toBe('Termo-de-Finalizacao-Briefing');
  });
});

describe('baixar todos os arquivos de um pedido', () => {
  it('nomes repetidos ganham número', () => {
    expect(nomesUnicos(['a.jpg', 'A.jpg', 'b', 'a.jpg', 'b'])).toEqual(['a.jpg', 'A (2).jpg', 'b', 'a (3).jpg', 'b (2)']);
  });

  it('junta os arquivos num .zip', async () => {
    const conteudo = { 'u1': 'um', 'u2': 'dois' };
    vi.stubGlobal('fetch', vi.fn(async (url) => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode(conteudo[url]).buffer })));
    let zip = null;
    vi.stubGlobal('URL', { ...URL, createObjectURL: (blob) => ((zip = blob), 'blob:x'), revokeObjectURL: () => {} });
    const db = { fileUrl: async (p) => (p === 'p/1' ? 'u1' : 'u2') };
    await baixarTodos(db, [{ name: 'foto.jpg', storagePath: 'p/1' }, { name: 'foto.jpg', storagePath: 'p/2' }, { name: 'sem', storagePath: null }], 'Referências');
    const arquivos = unzipSync(new Uint8Array(await zip.arrayBuffer()));
    expect(Object.keys(arquivos)).toEqual(['foto.jpg', 'foto (2).jpg']);
    expect(strFromU8(arquivos['foto (2).jpg'])).toBe('dois');
  });

  it('arquivos numa pasta fechada (rodada 12) e botão "Baixar todos"', async () => {
    const arquivos = Array.from({ length: 9 }, (_, i) => ({ id: 'a' + i, subId: 'b1', name: 'foto-' + i + '.jpg', sentBy: 'client', storagePath: 'x/' + i }));
    const db = {
      stages: () => [{ id: 's1', title: 'Briefing', status: 'em_andamento', subs: [{ id: 'b1', title: 'Referências', responsible: 'cliente', done: true, pedeArquivos: true }] }],
      subArquivos: () => arquivos,
    };
    render(<EnviosCliente db={db} project={{ id: 'p1' }} isStudio />);
    expect(screen.queryByText('foto-0.jpg')).toBeNull();
    expect(screen.getByRole('button', { name: /Baixar todos/ })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /9 arquivos enviados/ }));
    expect(screen.getByText('foto-8.jpg')).toBeTruthy();
  });
});

describe('tipo da sub-etapa no studio', () => {
  it('sub-etapa antiga sem responsável não mostra "undefined"', async () => {
    const { Timeline } = await import('../components/project/Timeline.jsx');
    const etapa = { id: 's1', projectId: 'p1', title: 'X', category: 'Etapa', status: 'em_andamento', subs: [{ id: 'b1', title: 'Fotos', kind: 'tarefa', done: false }] };
    render(<Timeline db={{ stages: () => [etapa], templates: () => [] }} project={{ id: 'p1' }} isStudio />);
    expect(screen.getByText('Tarefa')).toBeTruthy();
    expect(screen.queryByText(/undefined/)).toBeNull();
  });
});
