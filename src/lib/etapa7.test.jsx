/* Etapa 7: pendências (sino + janela ao entrar). */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { calcularPendencias } from './pendencias.js';
import { makeDb } from './db.js';
import { seed } from './seed.js';
import { PendenciasCtx } from './pendenciasContexto.js';
import { SinoPendencias } from '../components/Pendencias.jsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const P = [{ id: 'p1', name: 'Casa', status: 'em_andamento' }, { id: 'p9', name: 'Antigo', status: 'concluido' }];

describe('calcularPendencias', () => {
  it('cliente: documento, termo, orçamento e sub-etapa dele', () => {
    const r = calcularPendencias({
      role: 'client',
      projects: P,
      documents: [
        { id: 'd1', projectId: 'p1', name: 'Planta', approval: 'assinatura', response: null },
        { id: 'd2', projectId: 'p1', name: 'Ata', approval: 'ok', response: 'aprovado' },
        { id: 'd3', projectId: 'p1', name: 'Foto', approval: 'nenhuma' },
      ],
      contracts: [{ id: 'c1', projectId: 'p1', name: 'Imagens', kind: 'termo', sigStatus: 'enviado' }],
      quotes: [
        { id: 'q1', projectId: 'p1', supplier: 'Bianchi', segment: 'Marcenaria', status: 'pendente' },
        { id: 'q2', projectId: 'p1', supplier: 'Lumini', segment: 'Iluminação', status: 'aprovado' },
      ],
      stages: [
        { id: 's1', projectId: 'p1', title: 'Briefing', status: 'em_andamento', subs: [
          // rodada 4: só entra tarefa do cliente com prazo vencido ou em até 7 dias
          { id: 'b1', title: 'Enviar plantas', done: false, responsible: 'cliente', due: '2026-10-22' },
          { id: 'b2', title: 'Sem prazo', done: false, responsible: 'cliente' },
          { id: 'b3', title: 'Longe', done: false, responsible: 'cliente', due: '2026-12-01' },
          { id: 'b4', title: 'Reunião', done: false, responsible: 'studio', due: '2026-10-21' },
        ] },
      ],
    }, '2026-10-20');
    expect(r.map((x) => [x.aba, x.texto])).toEqual([
      ['docs', 'Assinar: Planta'],
      ['contract', 'Aprovar ou recusar: Imagens'],
      ['quotes', 'Decidir orçamento: Bianchi (Marcenaria)'],
      ['timeline', 'Tarefa: Enviar plantas · até 22/10'],
    ]);
  });

  it('studio: recusa, negociação e etapa atrasada do cliente; ignora projeto concluído', () => {
    const r = calcularPendencias(
      {
        role: 'studio',
        projects: P,
        contracts: [
          { id: 'c1', projectId: 'p1', name: 'Imagens', kind: 'termo', sigStatus: 'recusado' },
          { id: 'c2', projectId: 'p9', name: 'Velho', kind: 'termo', sigStatus: 'recusado' },
        ],
        quotes: [{ id: 'q1', projectId: 'p1', supplier: 'Bianchi', status: 'negociacao' }],
        stages: [{ id: 's1', projectId: 'p1', title: 'Medidas', status: 'a_fazer', owner: 'client', end: '2026-01-10' }],
      },
      '2026-10-07',
    );
    expect(r.map((x) => x.texto)).toEqual([
      'Recusado pelo cliente: Imagens',
      'Pedido de negociação: Bianchi',
      'Etapa do cliente atrasada: Medidas',
    ]);
  });
});

describe('sino e janela', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  function montar(user) {
    const irPara = vi.fn();
    const db = makeDb(structuredClone(seed), () => {});
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PendenciasCtx.Provider value={{ baseDb: db, user, irPara }}>
          <SinoPendencias />
        </PendenciasCtx.Provider>
      </QueryClientProvider>,
    );
    return irPara;
  }

  it('cliente vê a janela ao entrar e vai direto ao item da pendência', async () => {
    const irPara = montar({ id: 'u1', role: 'client', name: 'Vanessa' });
    expect(screen.getByRole('dialog', { name: /pendências no projeto/i })).toBeTruthy();
    await userEvent.click(screen.getByText(/Assinar: Planta/));
    // aba e item: o portal rola até o documento e o destaca
    expect(irPara).toHaveBeenCalledWith('p1', 'docs', 'doc-d3');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('o número do sino conta só as novas; depois de vistas, a lista continua', async () => {
    montar({ id: 'u1', role: 'client', name: 'Vanessa' });
    const sino = () => screen.getByRole('button', { name: /pendência/i });
    expect(Number(sino().textContent)).toBeGreaterThan(0);
    await userEvent.click(screen.getByText('Ver depois'));
    expect(screen.queryByRole('dialog')).toBeNull();
    // vistas: o número some…
    expect(sino().textContent).toBe('');
    // …mas o sino ainda mostra o que falta resolver
    await userEvent.click(sino());
    expect(screen.getByText(/Assinar: Planta/)).toBeTruthy();
    // remonta (outra tela ou outro acesso): a janela não volta, porque não há novidade
    cleanup();
    montar({ id: 'u1', role: 'client', name: 'Vanessa' });
    expect(screen.queryByRole('dialog', { name: /pendências no projeto/i })).toBeNull();
  });

  it('cliente de outro projeto não vê pendências que não são dele', () => {
    const db = makeDb(structuredClone(seed), () => {});
    const doU2 = db.pendencias('client', 'u2');
    expect(doU2.every((p) => p.pid === 'p2')).toBe(true);
  });
});
