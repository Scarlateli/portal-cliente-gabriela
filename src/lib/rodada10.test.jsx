/* Rodada 10 (melhorias de design, 22/10): próximo passo do cliente, fases
   do projeto, atraso do studio em tom neutro e etapas recolhidas. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Fases, ProximoPasso } from '../components/project/ProjectView.jsx';
import { Timeline } from '../components/project/Timeline.jsx';
import { proximaEtapa } from './pendencias.js';

describe('seu próximo passo', () => {
  const lista = [1, 2, 3, 4, 5, 6].map((i) => ({ id: 'x' + i, pid: 'p1', aba: 'docs', alvo: 'doc-d' + i, texto: 'Aprovar: Ata ' + i }));
  it('mostra a ação principal, 3 outras e "ver mais"', async () => {
    const abrir = vi.fn();
    render(<ProximoPasso lista={lista} abrir={abrir} />);
    expect(screen.getByText('Aprovar: Ata 1')).toBeTruthy();
    expect(screen.queryByText('Aprovar: Ata 5')).toBeNull();
    await userEvent.click(screen.getByText('Ver mais 2 pendências'));
    expect(screen.getByText('Aprovar: Ata 6')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Resolver/ }));
    expect(abrir).toHaveBeenCalledWith('docs', 'doc-d1');
  });
  it('sem pendências: tudo em dia', () => {
    render(<ProximoPasso lista={[]} abrir={() => {}} />);
    expect(screen.getByText(/Tudo em dia/)).toBeTruthy();
  });
});

describe('fases do projeto', () => {
  it('marca feitas, a atual e as futuras', () => {
    render(
      <Fases
        stages={[
          { id: 'a', title: 'Briefing', status: 'concluida' },
          { id: 'b', title: 'Estudo', status: 'em_andamento' },
          { id: 'c', title: 'Projeto', status: 'a_fazer' },
        ]}
      />,
    );
    const [a, b, c] = screen.getAllByRole('listitem');
    expect(a.className).toMatch(/fase-feita/);
    expect(b.getAttribute('aria-current')).toBe('step');
    expect(c.className).toMatch(/fase-futura/);
  });
});

const etapas = [
  { id: 's1', projectId: 'p1', title: 'Briefing', category: 'Etapa', status: 'concluida', owner: 'studio', start: '2026-01-01', end: '2026-01-10', subs: [] },
  {
    id: 's2', projectId: 'p1', title: 'Estudo', category: 'Etapa', status: 'em_andamento', owner: 'studio', start: '2026-01-11', end: '2026-01-20',
    subs: [{ id: 'b1', title: 'Planta', kind: 'entrega', responsible: 'studio', due: '2026-01-15', done: false }],
  },
  { id: 's3', projectId: 'p1', title: 'Projeto', category: 'Etapa', status: 'a_fazer', owner: 'studio', start: '', end: '', subs: [{ id: 'b2', title: 'Detalhes', kind: 'tarefa', responsible: 'studio', done: false }] },
];
const db = { stages: () => etapas, templates: () => [] };

describe('linha do tempo do cliente', () => {
  it('sem filtros; só a etapa atual aberta; as outras abrem ao tocar', async () => {
    render(<Timeline db={db} project={{ id: 'p1' }} isStudio={false} />);
    expect(screen.queryByRole('button', { name: 'Futuras' })).toBeNull();
    expect(screen.getByText('Planta')).toBeTruthy();
    expect(screen.queryByText('Detalhes')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Projeto/ }));
    expect(screen.getByText('Detalhes')).toBeTruthy();
  });

  it('atraso do studio aparece como "Nova data em definição", sem vermelho', () => {
    render(<Timeline db={db} project={{ id: 'p1' }} isStudio={false} />);
    const estudo = screen.getByText('Estudo').closest('li');
    expect(within(estudo).getByText('Nova data em definição')).toBeTruthy();
    expect(within(estudo).queryByText('Em atraso')).toBeNull();
    expect(within(estudo).queryByText(/Prazo venceu/)).toBeNull();
    // e a sub-etapa do studio vencida não mostra "Vencido" ao cliente
    expect(within(estudo).queryByText('Vencido')).toBeNull();
  });

  it('o studio continua vendo o atraso', () => {
    render(<Timeline db={db} project={{ id: 'p1' }} isStudio />);
    expect(screen.getAllByText('Em atraso').length).toBeGreaterThan(0);
  });

  it('topo: diz se a etapa atrasada é do cliente', () => {
    expect(proximaEtapa([{ title: 'X', status: 'em_andamento', end: '2026-01-01', owner: 'client' }], '2026-10-22')).toMatchObject({ atrasado: true, doCliente: true });
    expect(proximaEtapa([{ title: 'X', status: 'em_andamento', end: '2026-01-01', owner: 'studio' }], '2026-10-22')).toMatchObject({ atrasado: true, doCliente: false });
  });
});
