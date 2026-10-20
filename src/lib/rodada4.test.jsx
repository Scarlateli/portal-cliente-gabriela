/* Rodada 4 (revisão de 20/10): pendências só com prazo próximo, próximo
   prazo pelas sub-etapas, aprovação de etapa, confirmação de documento com
   "pedir ajustes" e envios do cliente com vários arquivos. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { calcularPendencias, proximoPrazo } from './pendencias.js';
import { makeDb } from './db.js';
import { seed } from './seed.js';
import { AprovacaoEtapa } from '../components/project/AprovacaoEtapa.jsx';
import { EnviosCliente } from '../components/project/EnviosCliente.jsx';
import { Documents } from '../components/project/Documents.jsx';

const P = [{ id: 'p1', name: 'Apto', status: 'em_andamento' }];
const HOJE = '2026-10-20';

describe('pendências da rodada 4', () => {
  const stages = [
    {
      id: 's1', projectId: 'p1', title: 'Briefing', status: 'em_andamento', approval: 'pendente',
      subs: [
        { id: 'b1', title: 'Plantas', responsible: 'cliente', done: false, due: '2026-10-24', pedeArquivos: true },
        { id: 'b2', title: 'Fotos', responsible: 'cliente', done: false, due: '2026-10-23', pedeArquivos: true },
        { id: 'b3', title: 'Medidas', responsible: 'cliente', done: false, due: '2026-11-30', pedeArquivos: true },
      ],
    },
    { id: 's2', projectId: 'p1', title: 'Estudo', status: 'a_fazer', approval: 'ajustes', subs: [] },
  ];
  const arquivos = [{ subId: 'b2' }];

  it('cliente: aprovar etapa sempre; pedido de arquivo só com prazo perto; com arquivo, pede para concluir', () => {
    const r = calcularPendencias({ role: 'client', projects: P, stages, arquivos }, HOJE);
    expect(r.map((x) => [x.aba, x.alvo, x.texto])).toEqual([
      ['timeline', 'etapa-s1', 'Aprovar a etapa: Briefing'],
      ['docs', 'pedido-b1', 'Enviar arquivos: Plantas · até 24/10'],
      ['docs', 'pedido-b2', 'Concluir entrega: Fotos · até 23/10'],
    ]);
  });

  it('studio: ajustes pedidos na etapa e entrega concluída pelo cliente para conferir', () => {
    // rodada 6: só avisa o studio quando o cliente conclui a entrega
    const comEntrega = stages.map((s) => ({ ...s, subs: s.subs.map((b) => (b.id === 'b2' ? { ...b, entregueEm: '2026-10-20T10:00:00Z' } : b)) }));
    const r = calcularPendencias(
      { role: 'studio', projects: P, stages: comEntrega, arquivos, documents: [{ id: 'd1', projectId: 'p1', name: 'Ata 1', response: 'ajustes' }] },
      HOJE,
    );
    expect(r.map((x) => x.texto)).toEqual([
      'Ajustes pedidos na etapa: Estudo',
      'Ajustes pedidos no documento: Ata 1',
      'Entrega do cliente para conferir: Fotos',
    ]);
  });

  it('documento pedindo aprovação aparece como "Aprovar"', () => {
    const r = calcularPendencias(
      { role: 'client', projects: P, documents: [{ id: 'd1', projectId: 'p1', name: 'Ata 1', approval: 'ok' }] },
      HOJE,
    );
    expect(r[0]).toMatchObject({ texto: 'Aprovar: Ata 1', alvo: 'doc-d1' });
  });
});

describe('próximo prazo do projeto', () => {
  it('conta as sub-etapas e diz qual é', () => {
    const r = proximoPrazo(
      [{ status: 'em_andamento', title: 'Briefing', end: '2026-12-01', subs: [{ title: 'Referências', due: '2026-10-26', done: false }] }],
      HOJE,
    );
    expect(r).toEqual({ data: '2026-10-26', titulo: 'Referências', atrasado: false });
  });
  it('ignora o que já foi feito e marca quando só sobrou prazo vencido', () => {
    const r = proximoPrazo(
      [{ status: 'em_andamento', title: 'X', subs: [{ title: 'Feita', due: '2026-10-25', done: true }, { title: 'Velha', due: '2026-10-01', done: false }] }],
      HOJE,
    );
    expect(r).toEqual({ data: '2026-10-01', titulo: 'Velha', atrasado: true });
    expect(proximoPrazo([], HOJE)).toBeNull();
  });
});

function harness() {
  let state = structuredClone(seed);
  const set = (fn) => {
    state = fn(state);
  };
  return () => makeDb(state, set);
}

describe('regras no banco de demonstração (espelham o Supabase)', () => {
  it('aprovação de etapa: só com pedido, com nome completo; ajustes exigem mensagem', () => {
    const db = harness();
    expect(() => db().responderEtapa('s1', 'aprovar', 'Vanessa Tamura')).toThrow(/não está aguardando/);
    db().pedirAprovacaoEtapa('s1');
    expect(() => db().responderEtapa('s1', 'aprovar', 'Va')).toThrow(/nome completo/);
    expect(() => db().responderEtapa('s1', 'ajustes', null, ' ')).toThrow(/ajustado/);
    db().responderEtapa('s1', 'aprovar', 'Vanessa Tamura');
    expect(db().stages('p1').find((s) => s.id === 's1')).toMatchObject({ approval: 'aprovada', approvalName: 'Vanessa Tamura' });
  });
  it('envios: vários arquivos num pedido aberto; pedido concluído não recebe', () => {
    const db = harness();
    db().enviarArquivos('p1', 'sb6', [{ name: 'a.pdf', size: 1000 }, { name: 'b.jpg', size: 2000 }], 'client');
    expect(db().subArquivos('p1').map((a) => a.name)).toEqual(['a.pdf', 'b.jpg']);
    db().toggleSub('s2', 'sb6');
    expect(() => db().enviarArquivos('p1', 'sb6', [{ name: 'c.pdf', size: 1 }], 'client')).toThrow(/não está aberto/);
  });
  it('documento: pedir ajustes guarda a mensagem; pedir de novo limpa', () => {
    const db = harness();
    db().responderDocumento('d3', null, 'ajustes', 'Faltou a cozinha');
    expect(db().documents('p1').find((d) => d.id === 'd3')).toMatchObject({ response: 'ajustes', responseNote: 'Faltou a cozinha' });
    db().setDocumentApproval('d3', 'assinatura');
    expect(db().documents('p1').find((d) => d.id === 'd3')).toMatchObject({ response: null, responseNote: null });
  });
});

describe('telas', () => {
  it('cliente aprova a etapa com nome e confirmação', async () => {
    const db = { responderEtapa: vi.fn(async () => {}) };
    render(<AprovacaoEtapa db={db} s={{ id: 's1', title: 'Briefing', approval: 'pendente' }} isStudio={false} projectId="p1" />);
    await userEvent.click(screen.getByText('Aprovar etapa'));
    const botao = screen.getByText('Confirmar aprovação');
    expect(botao.disabled).toBe(true);
    await userEvent.type(screen.getByLabelText('Nome completo para aprovar'), 'Nalva Vasconcelos');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(botao);
    expect(db.responderEtapa).toHaveBeenCalledWith('s1', 'aprovar', 'Nalva Vasconcelos', null);
  });

  it('cliente pede ajustes num documento', async () => {
    const db = {
      stages: () => [],
      documents: () => [{ id: 'd1', name: 'Ata 1', type: 'ata', size: '1 MB', date: HOJE, approval: 'ok', response: null }],
      responderDocumento: vi.fn(async () => {}),
    };
    render(<Documents db={db} project={{ id: 'p1' }} isStudio={false} />);
    expect(screen.getByText(/pede a sua aprovação/)).toBeTruthy();
    await userEvent.click(screen.getByText('Pedir ajustes'));
    await userEvent.type(screen.getByLabelText('O que precisa ser ajustado'), 'Data errada');
    await userEvent.click(screen.getByText('Enviar pedido de ajustes'));
    expect(db.responderDocumento).toHaveBeenCalledWith('d1', null, 'ajustes', 'Data errada');
  });

  it('cliente manda vários arquivos de uma vez num pedido', async () => {
    const pedido = { id: 'b1', title: 'Plantas', responsible: 'cliente', done: false, due: '', pedeArquivos: true, instructions: 'PDF das plantas' };
    const db = {
      stages: () => [{ id: 's1', title: 'Briefing', status: 'em_andamento', subs: [pedido] }],
      subArquivos: () => [],
      enviarArquivos: vi.fn(async () => {}),
    };
    const { container } = render(<EnviosCliente db={db} project={{ id: 'p1' }} isStudio={false} />);
    expect(screen.getByText('PDF das plantas')).toBeTruthy();
    const input = container.querySelector('input[type="file"]');
    expect(input.multiple).toBe(true);
    const f1 = new File(['a'], 'planta-1.pdf', { type: 'application/pdf' });
    const f2 = new File(['b'], 'planta-2.pdf', { type: 'application/pdf' });
    await userEvent.upload(input, [f1, f2]);
    expect(db.enviarArquivos).toHaveBeenCalledWith('p1', 'b1', [f1, f2], 'client');
  });
});
