/* Etapa 7: pendências (sino + janela ao entrar). */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
          { title: 'Enviar plantas', done: false, responsible: 'cliente' },
          { title: 'Reunião', done: false, responsible: 'studio' },
        ] },
      ],
    });
    expect(r.map((x) => [x.aba, x.texto])).toEqual([
      ['docs', 'Assinar o documento Planta'],
      ['contract', 'Aprovar ou recusar o termo Imagens'],
      ['quotes', 'Decidir sobre o orçamento de Bianchi (Marcenaria)'],
      ['timeline', 'Enviar plantas (Briefing)'],
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
      'Termo recusado pelo cliente: Imagens',
      'Pedido de negociação: Bianchi',
      'Etapa do cliente atrasada: Medidas',
    ]);
  });
});

describe('sino e janela', () => {
  beforeEach(() => sessionStorage.clear());

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

  it('cliente vê a janela ao entrar e vai direto à aba da pendência', async () => {
    const irPara = montar({ id: 'u1', role: 'client', name: 'Vanessa' });
    expect(screen.getByRole('dialog', { name: /pendências no projeto/i })).toBeTruthy();
    await userEvent.click(screen.getByText(/Assinar o documento Planta/));
    expect(irPara).toHaveBeenCalledWith('p1', 'docs');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"Ver depois" fecha e não reabre na mesma sessão; o sino continua com a contagem', async () => {
    montar({ id: 'u1', role: 'client', name: 'Vanessa' });
    await userEvent.click(screen.getByText('Ver depois'));
    expect(screen.queryByRole('dialog')).toBeNull();
    const sino = screen.getByRole('button', { name: /pendências/ });
    expect(Number(sino.textContent)).toBeGreaterThan(0);
    // remonta (outra tela): a janela não volta
    montar({ id: 'u1', role: 'client', name: 'Vanessa' });
    expect(screen.queryByRole('dialog', { name: /pendências no projeto/i })).toBeNull();
  });

  it('cliente de outro projeto não vê pendências que não são dele', () => {
    const db = makeDb(structuredClone(seed), () => {});
    const doU2 = db.pendencias('client', 'u2');
    expect(doU2.every((p) => p.pid === 'p2')).toBe(true);
  });
});
