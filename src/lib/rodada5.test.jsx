/* Rodada 5 (visão do studio, 20/10 à tarde): nome do cliente por projeto,
   prazo da etapa macro no topo, linha do tempo abrindo em "Em andamento",
   envio de documento com "pedir aprovação" e edição de termo/contrato. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { proximaEtapa } from './pendencias.js';
import { makeDb } from './db.js';
import { seed } from './seed.js';
import { DOC_TYPES } from './constants.js';
import { Timeline } from '../components/project/Timeline.jsx';
import { Documents } from '../components/project/Documents.jsx';
import { Contract } from '../components/project/Contract.jsx';

const HOJE = '2026-10-20';

describe('topo do projeto', () => {
  it('mostra a fase com o próximo prazo, só das etapas macro', () => {
    const r = proximaEtapa(
      [
        { title: 'BRIEFING', status: 'em_andamento', end: '2026-10-22', subs: [{ due: '2026-10-21', done: false }] },
        { title: 'ESTUDO', status: 'a_fazer', end: '2026-11-10' },
      ],
      HOJE,
    );
    expect(r).toEqual({ titulo: 'BRIEFING', data: '2026-10-22', atrasado: false });
  });
  it('sem prazo marcado, mostra a etapa em andamento', () => {
    expect(proximaEtapa([{ title: 'BRIEFING', status: 'em_andamento' }], HOJE)).toEqual({ titulo: 'BRIEFING', data: null, atrasado: false });
  });
});

function harness() {
  let state = structuredClone(seed);
  const set = (fn) => {
    state = fn(state);
  };
  return () => makeDb(state, set);
}

describe('nome do cliente', () => {
  it('vale o nome digitado no projeto; a edição troca só neste projeto', () => {
    const db = harness();
    db().addProject({ code: 'C1', name: 'Casa', clientName: 'Maria e João', clientEmail: 'mj@x.com', pass: '1234', etapas: [] });
    const p = db().projects().find((x) => x.code === 'C1');
    expect(db().clientName(p.id)).toBe('Maria e João');
    db().updateProject(p.id, { code: 'C1', name: 'Casa', clientName: 'Maria Silva' });
    expect(db().clientName(p.id)).toBe('Maria Silva');
    // outro projeto continua com o nome dele
    expect(db().clientName('p1')).toBe('Vanessa Tamura');
  });
});

describe('documentos', () => {
  it('categorias: Atas de Reunião, Entregas de Projeto e Documentos Gerais', () => {
    expect(DOC_TYPES.map((t) => t.label)).toEqual(['Atas de Reunião', 'Entregas de Projeto', 'Documentos Gerais']);
  });

  it('enviar documento: escolhe o arquivo, a categoria e pede aprovação', async () => {
    const db = { stages: () => [], documents: () => [], addDocument: vi.fn(async () => {}) };
    const { container } = render(<Documents db={db} project={{ id: 'p1' }} isStudio />);
    await userEvent.click(screen.getByText('Enviar Documento'));
    const arquivo = new File(['x'], 'ata-1.pdf', { type: 'application/pdf' });
    await userEvent.upload(container.querySelector('input[type="file"]'), arquivo);
    await userEvent.selectOptions(screen.getByLabelText('Categoria do documento'), 'ata');
    await userEvent.click(screen.getByLabelText(/Pedir aprovação do cliente/));
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(db.addDocument).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'ata-1.pdf', type: 'ata', approval: 'ok' }), arquivo);
  });
});

describe('linha do tempo', () => {
  const etapas = [
    { id: 's1', projectId: 'p1', title: 'BRIEFING', category: 'Etapa', status: 'em_andamento', owner: 'studio', subs: [] },
    { id: 's2', projectId: 'p1', title: 'ESTUDO', category: 'Etapa', status: 'a_fazer', owner: 'studio', subs: [] },
  ];
  const db = { stages: () => etapas, templates: () => [] };
  it('abre em "Em andamento" também para o studio e não repete "Etapa" nem o studio', () => {
    render(<Timeline db={db} project={{ id: 'p1' }} isStudio />);
    expect(screen.getByText('BRIEFING')).toBeTruthy();
    expect(screen.queryByText('ESTUDO')).toBeNull();
    expect(screen.queryByText('Etapa')).toBeNull();
    expect(screen.queryByText(/Responsável: Studio/)).toBeNull();
    expect(screen.queryByText(/Nº 01/)).toBeNull();
  });
});

describe('contratos e termos', () => {
  it('studio edita o termo (nome e texto)', async () => {
    const termo = { id: 'c1', projectId: 'p1', kind: 'termo', method: 'aceite', name: 'Termo de Finalização', body: 'Texto antigo', sigStatus: 'enviado' };
    const db = { contracts: () => [termo], clientName: () => 'Cliente', updateContractDoc: vi.fn(async () => {}), checkAutentique: () => {} };
    render(<Contract db={db} project={{ id: 'p1' }} isStudio />);
    await userEvent.click(screen.getByText('Editar'));
    const texto = screen.getByLabelText('Texto do documento');
    await userEvent.clear(texto);
    await userEvent.type(texto, 'O cliente declara finalizada a etapa.');
    await userEvent.click(screen.getByText('Salvar'));
    expect(db.updateContractDoc).toHaveBeenCalledWith('p1', 'c1', { name: 'Termo de Finalização', body: 'O cliente declara finalizada a etapa.' }, null);
  });
});
