/* Rodada 12 (feedback da Gabriela, 23/10). */
import { describe, it, expect } from 'vitest';
import { makeDb } from './db.js';
import { seed } from './seed.js';
import { newProjectSchema, validate } from './validation.js';

const harness = () => {
  let state = structuredClone(seed);
  return () => makeDb(state, (fn) => (state = fn(state)));
};

describe('projeto sem e-mail, acesso liberado depois', () => {
  it('o cadastro aceita e-mail em branco, mas não e-mail inválido', () => {
    const base = { code: 'X1', name: 'Casa', clientName: 'Família X', pass: '1234' };
    expect(validate(newProjectSchema, { ...base, clientEmail: '' }).ok).toBe(true);
    expect(validate(newProjectSchema, { ...base, clientEmail: 'nao-e-email' }).ok).toBe(false);
  });
  it('nasce sem cliente e ganha o acesso ao informar o e-mail', () => {
    const db = harness();
    db().addProject({ code: 'X1', name: 'Casa', clientName: 'Família X', clientEmail: '', pass: '1234', etapas: [] });
    const p = db().projects().find((x) => x.code === 'X1');
    expect(p.clientId).toBeNull();
    expect(db().clientName(p.id)).toBe('Família X');
    const r = db().liberarAcesso(p.id, ' Familia@X.com ');
    expect(r).toMatchObject({ email: 'familia@x.com', jaTinhaAcesso: false });
    const depois = db().projects().find((x) => x.code === 'X1');
    expect(depois.clientId).toBeTruthy();
    expect(db().projectsForClient(depois.clientId).map((x) => x.code)).toContain('X1');
    expect(() => db().liberarAcesso(p.id, 'outro@x.com')).toThrow(/já tem acesso/);
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Timeline } from '../components/project/Timeline.jsx';
import { EnviosCliente } from '../components/project/EnviosCliente.jsx';
import { EtapasEditor } from '../components/admin/EtapasEditor.jsx';

describe('Linha do Tempo igual para studio e cliente', () => {
  const etapa = {
    id: 's1', projectId: 'p1', title: 'BRIEFING', category: 'Etapa', status: 'em_andamento', owner: 'studio', start: '2026-10-20', end: '2026-10-22',
    subs: [
      { id: 'b1', title: 'Catalogação', kind: 'tarefa', responsible: 'cliente', due: '', done: false, pedeArquivos: false },
      { id: 'b2', title: 'Escopo', kind: 'entrega', responsible: 'studio', due: '', done: false },
    ],
  };
  const montar = (isStudio, extra = {}) => {
    const db = { stages: () => [etapa], templates: () => [], subArquivos: () => [], concluirTarefa: vi.fn(async () => {}), ...extra };
    render(<Timeline db={db} project={{ id: 'p1' }} isStudio={isStudio} />);
    return db;
  };
  for (const isStudio of [true, false]) {
    it((isStudio ? 'studio' : 'cliente') + ': abas Em andamento/Todas, etapa que abre e fecha, datas com símbolo', async () => {
      montar(isStudio);
      expect(screen.getAllByRole('button', { name: /^(Em andamento|Todas)$/ })).toHaveLength(2);
      expect(screen.getByRole('button', { name: 'BRIEFING' }).getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByTitle('Início').textContent).toMatch(/20\/10\/2026/);
      expect(screen.getByTitle('Entrega').textContent).toMatch(/22\/10\/2026/);
      expect(screen.getByText('Tarefa – Cliente')).toBeTruthy();
      expect(screen.queryByText('Essa é uma tarefa sua')).toBeNull();
    });
  }
  it('cliente marca como feita uma tarefa dele sem arquivos', async () => {
    const db = montar(false);
    await userEvent.click(screen.getByRole('button', { name: /Marcar como feita/ }));
    expect(db.concluirTarefa).toHaveBeenCalledWith('s1', 'b1');
  });
  it('studio: setas e lápis só com o ponteiro em cima (sem depender do CSS)', async () => {
    montar(true);
    const linha = screen.getByText('Escopo').closest('li');
    const acoes = linha.querySelector('.sub-acoes');
    expect(acoes.style.visibility).toBe('hidden');
    await userEvent.hover(linha);
    expect(acoes.style.visibility).toBe('visible');
    await userEvent.unhover(linha);
    expect(acoes.style.visibility).toBe('hidden');
  });
  it('banco de demonstração: cliente conclui a tarefa e anota um arquivo', () => {
    const db = harness();
    db().addSub('s2', { title: 'Medidas', kind: 'tarefa', responsible: 'cliente', pedeArquivos: false });
    const sub = db().stages('p1').find((s) => s.id === 's2').subs.find((b) => b.title === 'Medidas');
    db().concluirTarefa('s2', sub.id);
    expect(db().stages('p1').find((s) => s.id === 's2').subs.find((b) => b.id === sub.id).done).toBe(true);
    db().enviarArquivos('p1', 'sb6', [{ name: 'a.jpg', size: 1 }], 'client');
    const arq = db().subArquivos('p1')[0];
    db().anotarArquivo('p1', arq.id, '  Parede da TV ');
    expect(db().subArquivos('p1')[0].nota).toBe('Parede da TV');
  });
});

describe('Envios: pasta, recado à vista e observação por arquivo', () => {
  const pedido = { id: 'b1', title: 'Referências', responsible: 'cliente', done: false, due: '', pedeArquivos: true, instructions: '' };
  const montar = (b, isStudio = false, nota = null) => {
    const db = {
      stages: () => [{ id: 's1', title: 'Briefing', status: 'em_andamento', subs: [b] }],
      subArquivos: () => [{ id: 'a1', subId: 'b1', name: 'sala.jpg', sentBy: 'client', storagePath: 'x', nota }],
      anotarArquivo: vi.fn(async () => {}),
      setNotaPedido: vi.fn(async () => {}),
      enviarArquivos: vi.fn(),
    };
    render(<EnviosCliente db={db} project={{ id: 'p1' }} isStudio={isStudio} />);
    return db;
  };
  it('cliente vê o campo de recado sem precisar procurar e salva', async () => {
    const db = montar(pedido);
    const campo = screen.getByLabelText(/Recado para o studio/);
    await userEvent.type(campo, 'Fotos do quarto amanhã');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar recado' }));
    expect(db.setNotaPedido).toHaveBeenCalledWith('s1', 'b1', 'Fotos do quarto amanhã');
  });
  it('cliente escreve uma observação em cada referência', async () => {
    const db = montar(pedido);
    await userEvent.click(screen.getByRole('button', { name: /1 arquivo enviado/ }));
    await userEvent.click(screen.getByText('Escrever sobre esta referência'));
    await userEvent.type(screen.getByLabelText('Observação sobre sala.jpg'), 'Gosto da luz');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(db.anotarArquivo).toHaveBeenCalledWith('p1', 'a1', 'Gosto da luz');
  });
  it('studio lê a observação e o recado, sem editar', async () => {
    montar({ ...pedido, clientNote: 'Vale a parede' }, true, 'Gosto da luz');
    expect(screen.getByText('Recado do cliente')).toBeTruthy();
    expect(screen.getByText('Vale a parede')).toBeTruthy();
    expect(screen.queryByLabelText(/Recado para o studio/)).toBeNull();
    expect(screen.getByText('com observações')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /1 arquivo enviado/ }));
    expect(screen.getByText('“Gosto da luz”')).toBeTruthy();
    expect(screen.queryByText(/Escrever sobre/)).toBeNull();
  });
});

describe('template: descrição da etapa e das sub-etapas', () => {
  it('escreve as descrições e, em tarefa do cliente, já pede arquivos', async () => {
    let itens = [{ title: 'Briefing', category: 'Etapa', desc: '', subs: [{ title: 'Fotos', kind: 'tarefa', kindLabel: '', responsible: 'studio' }] }];
    const { rerender } = render(<EtapasEditor itens={itens} onChange={(n) => (itens = n)} />);
    const atualizar = () => rerender(<EtapasEditor itens={itens} onChange={(n) => (itens = n)} />);
    await userEvent.type(screen.getByLabelText('Descrição da etapa 1'), 'C');
    atualizar();
    await userEvent.type(screen.getByLabelText('Descrição da sub-etapa 1 da etapa 1'), 'M');
    atualizar();
    await userEvent.selectOptions(screen.getByLabelText('Responsável pela sub-etapa'), 'cliente');
    atualizar();
    expect(itens[0].desc).toBe('C');
    expect(itens[0].subs[0]).toMatchObject({ instructions: 'M', responsible: 'cliente', pedeArquivos: true });
    expect(screen.getByLabelText(/Pedir arquivos ao cliente/).checked).toBe(true);
  });
  it('o banco de demonstração leva as descrições do template para o projeto', () => {
    const db = harness();
    db().addTemplate('T', [{ title: 'Etapa A', category: 'Etapa', desc: 'Sobre A', subs: [{ title: 'Sub', kind: 'tarefa', responsible: 'cliente', pedeArquivos: true, instructions: 'Como fazer' }] }]);
    const t = db().templates().find((x) => x.name === 'T');
    db().applyTemplate('p1', t.id);
    const e = db().stages('p1').find((s) => s.title === 'Etapa A');
    expect(e.desc).toBe('Sobre A');
    expect(e.subs[0]).toMatchObject({ instructions: 'Como fazer', pedeArquivos: true });
  });
});
