/* Rodada 6 (visão do cliente, 20/10 à noite): lista de sub-etapas no
   desenho da Gabriela (sem caixinha para o cliente, "Essa é uma tarefa sua",
   data e ação à direita) e "Concluir entrega" nos Envios do Cliente. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { quandoSub } from './etapas.js';
import { makeDb } from './db.js';
import { seed } from './seed.js';
import { Timeline } from '../components/project/Timeline.jsx';
import { EnviosCliente } from '../components/project/EnviosCliente.jsx';

const HOJE = '2026-10-20';

describe('data à direita da sub-etapa', () => {
  it('hoje, amanhã, até, vencida e reunião com horário', () => {
    expect(quandoSub({ kind: 'entrega', due: HOJE }, HOJE)).toEqual({ estado: 'hoje', data: 'Hoje', hora: '' });
    expect(quandoSub({ kind: 'tarefa', due: '2026-10-21' }, HOJE).data).toBe('Amanhã');
    expect(quandoSub({ kind: 'tarefa', due: '2026-10-30' }, HOJE).data).toBe('Até 30/10');
    expect(quandoSub({ kind: 'tarefa', due: '2026-10-01' }, HOJE)).toMatchObject({ estado: 'atrasado', data: 'Venceu 01/10' });
    expect(quandoSub({ kind: 'reuniao', due: HOJE, time: '15:00' }, HOJE)).toEqual({ estado: 'hoje', data: 'Hoje', hora: '15:00' });
    expect(quandoSub({ kind: 'tarefa', due: '2027-01-05' }, HOJE).data).toBe('Até 05/01/27');
    expect(quandoSub({ kind: 'tarefa', due: '' }, HOJE)).toBeNull();
    expect(quandoSub({ kind: 'tarefa', due: '2026-10-01', done: true }, HOJE).data).toBe('Concluída');
  });
});

const etapa = {
  id: 's1', projectId: 'p1', title: 'ESTUDO PRELIMINAR', category: 'Etapa', status: 'em_andamento', owner: 'studio', start: '2026-10-20', end: '2026-10-30',
  subs: [
    { id: 'b1', title: 'Escopo de Projeto', kind: 'entrega', responsible: 'studio', due: '', done: false, instructions: 'Pequena descrição' },
    { id: 'b2', title: 'Referências dos Clientes', kind: 'tarefa', responsible: 'cliente', due: '', done: false, pedeArquivos: true, instructions: 'Enviar suas referências e ideias' },
    { id: 'b3', title: 'Reunião de Briefing', kind: 'reuniao', responsible: 'studio', due: '', time: '15:00', format: 'online', link: 'https://meet.google.com/abc', done: false },
  ],
};
const dbTimeline = () => ({ stages: () => [etapa], templates: () => [], subArquivos: () => [], toggleSub: vi.fn() });

describe('linha do tempo no desenho da Gabriela', () => {
  it('cliente: sem caixinha, tarefa dele em destaque, upload e reunião à direita', async () => {
    const abrir = vi.fn();
    render(<Timeline db={dbTimeline()} project={{ id: 'p1' }} isStudio={false} abrir={abrir} />);
    expect(screen.queryByRole('button', { name: /Concluir/ })).toBeNull();
    const itens = screen.getAllByRole('listitem').filter((li) => li.classList.contains('sub'));
    expect(within(itens[0]).getByText('Pequena descrição')).toBeTruthy();
    expect(within(itens[0]).getByText('Entrega')).toBeTruthy();
    expect(within(itens[1]).getByText('Essa é uma tarefa sua')).toBeTruthy();
    await userEvent.click(within(itens[1]).getByRole('button', { name: /Fazer upload/ }));
    expect(abrir).toHaveBeenCalledWith('docs', 'pedido-b2');
    expect(within(itens[2]).getByRole('link', { name: /Entrar na reunião/ }).getAttribute('href')).toBe('https://meet.google.com/abc');
    // datas da etapa, uma por linha
    expect(screen.getByText('Data de Início – 20/10/2026')).toBeTruthy();
    expect(screen.getByText('Previsão de Entrega – 30/10/2026')).toBeTruthy();
  });

  it('studio: conclui pela bolinha e vê "Tarefa do cliente"', async () => {
    const db = dbTimeline();
    render(<Timeline db={db} project={{ id: 'p1' }} isStudio />);
    expect(screen.getByText('Tarefa do cliente')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Concluir Escopo de Projeto' }));
    expect(db.toggleSub).toHaveBeenCalledWith('s1', 'b1');
  });
});

function harness() {
  let state = structuredClone(seed);
  const set = (fn) => {
    state = fn(state);
  };
  return () => makeDb(state, set);
}

describe('concluir entrega (regras iguais às do banco)', () => {
  it('precisa de arquivo; depois trava o envio; studio devolve ou reabre', () => {
    const db = harness();
    const sub = () => db().stages('p1').find((s) => s.id === 's2').subs.find((b) => b.id === 'sb6');
    expect(() => db().concluirEntrega('s2', 'sb6')).toThrow(/pelo menos um arquivo/);
    db().enviarArquivos('p1', 'sb6', [{ name: 'a.pdf', size: 1000 }], 'client');
    db().concluirEntrega('s2', 'sb6');
    expect(sub().entregueEm).toBeTruthy();
    expect(() => db().concluirEntrega('s2', 'sb6')).toThrow(/já foi entregue/);
    expect(() => db().enviarArquivos('p1', 'sb6', [{ name: 'b.pdf', size: 1 }], 'client')).toThrow(/não está aberto/);
    db().reabrirPedido('s2', 'sb6');
    expect(sub()).toMatchObject({ entregueEm: null, done: false });
    db().concluirEntrega('s2', 'sb6');
    db().toggleSub('s2', 'sb6'); // studio confere
    db().toggleSub('s2', 'sb6'); // e reabre: volta a ficar aberto para o cliente
    expect(sub()).toMatchObject({ entregueEm: null, done: false });
  });
});

describe('Envios do Cliente', () => {
  const pedido = { id: 'b1', title: 'Referências', responsible: 'cliente', done: false, due: '', pedeArquivos: true, instructions: '' };
  const montar = (b, isStudio = false) => {
    const db = {
      stages: () => [{ id: 's1', title: 'Briefing', status: 'em_andamento', subs: [b] }],
      subArquivos: () => [{ id: 'a1', subId: 'b1', name: 'foto.jpg', sentBy: 'client', storagePath: 'x' }],
      concluirEntrega: vi.fn(async () => {}),
      reabrirPedido: vi.fn(async () => {}),
      toggleSub: vi.fn(),
      enviarArquivos: vi.fn(),
    };
    render(<EnviosCliente db={db} project={{ id: 'p1' }} isStudio={isStudio} />);
    return db;
  };

  it('cliente conclui a entrega com confirmação', async () => {
    const db = montar(pedido);
    await userEvent.click(screen.getByRole('button', { name: /Concluir entrega/ }));
    expect(db.concluirEntrega).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /Sim, concluir entrega/ }));
    expect(db.concluirEntrega).toHaveBeenCalledWith('s1', 'b1');
  });

  it('entregue: o cliente não envia, não remove e não muda o recado', () => {
    montar({ ...pedido, entregueEm: '2026-10-20T12:00:00Z' });
    expect(screen.queryByRole('button', { name: /Enviar mais arquivos/ })).toBeNull();
    expect(screen.queryByLabelText('Remover foto.jpg')).toBeNull();
    expect(screen.queryByText('Deixar um recado para o studio')).toBeNull();
    expect(screen.getByText(/Entrega concluída em 20\/10\/2026/)).toBeTruthy();
  });

  it('studio confere ou devolve ao cliente', async () => {
    const db = montar({ ...pedido, entregueEm: '2026-10-20T12:00:00Z' }, true);
    await userEvent.click(screen.getByRole('button', { name: /Devolver ao cliente/ }));
    expect(db.reabrirPedido).toHaveBeenCalledWith('s1', 'b1');
  });
});
