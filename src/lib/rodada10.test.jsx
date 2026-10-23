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
  it('abas Em andamento e Todas; em Todas só a atual aberta e as outras abrem ao tocar (rodada 12)', async () => {
    render(<Timeline db={db} project={{ id: 'p1' }} isStudio={false} />);
    expect(screen.queryByRole('button', { name: 'Futuras' })).toBeNull();
    expect(screen.getByText('Planta')).toBeTruthy();
    expect(screen.queryByText('Projeto')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Todas' }));
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

describe('agenda geral do studio', async () => {
  const { agendaGeral, rotuloDia } = await import('./agendaStudio.js');
  const HOJE = '2026-10-22';
  const dados = {
    projects: [{ id: 'p1', name: 'Casa A', status: 'em_andamento' }, { id: 'p2', name: 'Casa B', status: 'concluido' }],
    stages: [
      {
        id: 's1', projectId: 'p1', title: 'Briefing', category: 'Etapa', status: 'em_andamento', owner: 'studio', end: '2026-10-25',
        subs: [
          { id: 'b1', title: 'Reunião', kind: 'reuniao', due: '2026-10-22', time: '15:00', format: 'online', link: 'https://meet', done: false },
          { id: 'b2', title: 'Planta', kind: 'entrega', due: '2026-10-10', done: false },
          { id: 'b3', title: 'Fotos', kind: 'tarefa', due: '2026-10-23', responsible: 'cliente', pedeArquivos: true, done: false },
          { id: 'b4', title: 'Longe', kind: 'tarefa', due: '2026-12-01', done: false },
          { id: 'b5', title: 'Feita', kind: 'tarefa', due: '2026-10-23', done: true },
        ],
      },
      { id: 's2', projectId: 'p2', title: 'Projeto encerrado', category: 'Etapa', status: 'em_andamento', end: '2026-10-23', subs: [] },
    ],
    events: [{ id: 'e1', projectId: 'p1', date: '2026-10-24', title: 'Visita à loja', time: '10:00' }],
  };
  it('separa atrasados e próximos 7 dias, só de projetos ativos', () => {
    const r = agendaGeral(dados, HOJE);
    expect(r.atrasados.map((x) => x.titulo)).toEqual(['Planta']);
    expect(r.proximos.map((x) => x.titulo)).toEqual(['Reunião', 'Fotos', 'Visita à loja', 'Briefing']);
    expect(r.proximos[1]).toMatchObject({ quem: 'Cliente', aba: 'docs', alvo: 'pedido-b3', projeto: 'Casa A' });
    expect(r.proximos[0]).toMatchObject({ hora: '15:00', link: 'https://meet' });
  });
  it('rótulos de dia', () => {
    expect(rotuloDia('2026-10-22', HOJE)).toBe('Hoje');
    expect(rotuloDia('2026-10-23', HOJE)).toBe('Amanhã');
    expect(rotuloDia('2026-10-28', HOJE)).toBe('qua, 28/10');
  });
});

describe('etapa no studio: status no balão e ações no menu ⋯', () => {
  it('troca o status pelo seletor e edita pelo menu', async () => {
    const db2 = { stages: () => [etapas[1]], templates: () => [], setStageStatus: vi.fn() };
    render(<Timeline db={db2} project={{ id: 'p1' }} isStudio />);
    expect(screen.queryByRole('button', { name: 'Concluída' })).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Status da etapa', { selector: 'select' }), 'concluida');
    expect(db2.setStageStatus).toHaveBeenCalledWith('s2', 'concluida');
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações da etapa Estudo' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Editar etapa/ }));
    expect(screen.getByLabelText('Título da etapa')).toBeTruthy();
  });
});

describe('avisos com desfazer', async () => {
  const { AvisosProvider } = await import('../components/Avisos.jsx');
  const { useAvisos } = await import('./avisosContexto.js');
  function Lista({ executar }) {
    const { excluirComDesfazer, ocultos } = useAvisos();
    return ['a', 'b'].filter((id) => !ocultos.has(id)).map((id) => (
      <button key={id} onClick={() => excluirComDesfazer({ id, texto: 'Item ' + id + ' excluído', executar: () => executar(id) })}>
        excluir {id}
      </button>
    ));
  }
  it('some na hora, "Desfazer" traz de volta e nada vai ao banco', async () => {
    const executar = vi.fn();
    render(<AvisosProvider><Lista executar={executar} /></AvisosProvider>);
    await userEvent.click(screen.getByText('excluir a'));
    expect(screen.queryByText('excluir a')).toBeNull();
    expect(screen.getByText('Item a excluído')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Desfazer/ }));
    expect(screen.getByText('excluir a')).toBeTruthy();
    expect(executar).not.toHaveBeenCalled();
  });
  it('sem desfazer, exclui depois de alguns segundos', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const executar = vi.fn();
    render(<AvisosProvider><Lista executar={executar} /></AvisosProvider>);
    await userEvent.click(screen.getByText('excluir b'));
    expect(executar).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(6100);
    expect(executar).toHaveBeenCalledWith('b');
    vi.useRealTimers();
  });
});

describe('visualizador e envio arrastando', async () => {
  const { Visualizador } = await import('../components/project/Visualizador.jsx');
  const { EnviosCliente } = await import('../components/project/EnviosCliente.jsx');
  const { fireEvent } = await import('@testing-library/react');
  it('abre a imagem no portal (blob) com o painel ao lado', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob(['x'], { type: 'image/png' }) })));
    const criar = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:teste');
    const db2 = { fileUrl: async () => 'https://assinada' };
    render(
      <Visualizador db={db2} arquivo={{ name: 'foto.png', storagePath: 'p1/foto.png' }} onFechar={() => {}}>
        <p>Painel de aprovação</p>
      </Visualizador>,
    );
    expect(await screen.findByRole('img', { name: 'foto.png' })).toBeTruthy();
    expect(screen.getByText('Painel de aprovação')).toBeTruthy();
    criar.mockRestore();
    vi.unstubAllGlobals();
  });
  it('sem arquivo (demonstração): avisa em vez de quebrar', async () => {
    render(<Visualizador db={{ fileUrl: async () => null }} arquivo={{ name: 'a.pdf', storagePath: null }} onFechar={() => {}} />);
    expect(await screen.findByText(/indisponível/)).toBeTruthy();
  });
  it('soltar arquivos envia um de cada vez', async () => {
    const pedido = { id: 'b1', title: 'Plantas', responsible: 'cliente', done: false, due: '', pedeArquivos: true };
    const db3 = { stages: () => [{ id: 's1', title: 'Briefing', status: 'em_andamento', subs: [pedido] }], subArquivos: () => [], enviarArquivos: vi.fn(async () => {}) };
    const { container } = render(<EnviosCliente db={db3} project={{ id: 'p1' }} isStudio={false} />);
    const f1 = new File(['a'], 'a.pdf', { type: 'application/pdf' });
    const f2 = new File(['b'], 'b.jpg', { type: 'image/jpeg' });
    fireEvent.drop(container.querySelector('.soltar'), { dataTransfer: { files: [f1, f2] } });
    await screen.findByText('b.jpg');
    await vi.waitFor(() => expect(db3.enviarArquivos).toHaveBeenCalledTimes(2));
    expect(db3.enviarArquivos).toHaveBeenNthCalledWith(1, 'p1', 'b1', [f1], 'client');
  });
});

describe('navegação no celular', async () => {
  const { NavInferior } = await import('../components/project/ProjectView.jsx');
  it('4 itens, contagem de pendências e "Mais" com as outras seções', async () => {
    const setTab = vi.fn();
    window.scrollTo = vi.fn();
    const pend = [{ id: '1', aba: 'docs' }, { id: '2', aba: 'contract' }, { id: '3', aba: 'quotes' }];
    render(<NavInferior tab="timeline" setTab={setTab} pendencias={pend} />);
    const barra = screen.getByRole('navigation', { name: 'Seções do projeto' });
    expect(within(barra).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Início', 'Documentos, 1 pendência', 'Agenda', 'Mais, 2 pendências']);
    await userEvent.click(within(barra).getByRole('button', { name: /Mais/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Orçamentos/ }));
    expect(setTab).toHaveBeenCalledWith('quotes');
  });
});
