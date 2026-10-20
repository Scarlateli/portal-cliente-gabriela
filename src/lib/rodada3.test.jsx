/* Rodada 3 (revisão de 19/10): prazos claros nas sub-etapas, tipos iguais
   aos das etapas e tipo livre, mudar a ordem das sub-etapas, editar uma
   sub-etapa existente, endereço completo e vocativo. */
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeDb } from './db.js';
import { seed } from './seed.js';
import { prazoSub, rotuloTipoSub, moverNaLista, SUB_TIPOS } from './etapas.js';
import { STAGE_CATEGORIES } from './constants.js';
import { enderecoCurto, enderecoCompleto, formatarCep, vocativo } from './endereco.js';
import { EtapasEditor } from '../components/admin/EtapasEditor.jsx';
import { Timeline } from '../components/project/Timeline.jsx';

function harness() {
  let state = structuredClone(seed);
  const set = (fn) => {
    state = fn(state);
  };
  return () => makeDb(state, set);
}

describe('prazo das sub-etapas', () => {
  const hoje = '2026-10-19';
  it('diz quando não há prazo', () => {
    expect(prazoSub({ kind: 'entrega', due: '' }, hoje)).toEqual({ estado: 'sem', texto: 'Sem prazo' });
    expect(prazoSub({ kind: 'reuniao', due: '' }, hoje).texto).toBe('Sem data');
  });
  it('mostra o prazo e avisa atraso e vencimento hoje', () => {
    expect(prazoSub({ kind: 'entrega', due: '2026-10-30' }, hoje)).toEqual({ estado: 'ok', texto: 'Até 30/10/2026' });
    expect(prazoSub({ kind: 'entrega', due: '2026-10-19' }, hoje)).toEqual({ estado: 'hoje', texto: 'Vence hoje' });
    expect(prazoSub({ kind: 'tarefa', due: '2026-10-01' }, hoje)).toEqual({
      estado: 'atrasado',
      texto: 'Atrasada · venceu 01/10/2026',
    });
  });
  it('reunião mostra data, horário e formato; feita não fica atrasada', () => {
    expect(prazoSub({ kind: 'reuniao', due: '2026-10-25', time: '13:30', format: 'online' }, hoje).texto).toBe(
      '25/10/2026 às 13:30 · online',
    );
    expect(prazoSub({ kind: 'tarefa', due: '2026-10-01', done: true }, hoje).estado).toBe('feito');
  });
});

describe('tipos das sub-etapas', () => {
  it('têm os mesmos tipos das etapas (menos "Etapa"), mais tarefa e tipo livre', () => {
    const rotulos = SUB_TIPOS.map(([, r]) => r.replace(' (escrever)', ''));
    STAGE_CATEGORIES.filter((c) => c !== 'Etapa').forEach((c) => expect(rotulos).toContain(c));
    expect(rotuloTipoSub({ kind: 'outro', kindLabel: 'Aprovação do condomínio' })).toBe('Aprovação do condomínio');
    expect(rotuloTipoSub({ kind: 'visita' })).toBe('Visita técnica');
  });
  it('"Etapa" é o tipo padrão de uma etapa nova', () => {
    expect(STAGE_CATEGORIES[0]).toBe('Etapa');
  });
});

describe('ordem das sub-etapas', () => {
  it('moverNaLista troca com a vizinha e ignora as pontas', () => {
    expect(moverNaLista(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moverNaLista(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });
  it('no banco de demonstração, sobe, desce e edita sem perder o que foi feito', () => {
    const db = harness();
    db().addSub('s3', { title: 'Escopo', kind: 'entrega', responsible: 'studio' });
    db().addSub('s3', { title: 'Reunião de briefing', kind: 'reuniao', responsible: 'studio' });
    const subsDe = () => db().stages('p1').find((s) => s.id === 's3').subs;
    const [a, b] = subsDe();
    db().toggleSub('s3', a.id);
    db().moveSub('s3', b.id, -1);
    expect(subsDe().map((x) => x.title)).toEqual(['Reunião de briefing', 'Escopo']);
    db().updateSub('s3', a.id, { title: 'Escopo do projeto', kind: 'outro', kindLabel: 'Aprovação', responsible: 'cliente', due: '2026-11-02' });
    const editada = subsDe().find((x) => x.id === a.id);
    expect(editada).toMatchObject({ title: 'Escopo do projeto', kind: 'outro', kindLabel: 'Aprovação', responsible: 'cliente', due: '2026-11-02', done: true });
  });
});

describe('endereço e vocativo', () => {
  const p = { address: 'Rua Francisca Júlia, 215', addressComplement: 'Apto 72', neighborhood: 'Santana', city: 'São Paulo', state: 'SP', cep: '02403-010' };
  it('forma curta nas telas e completa com CEP', () => {
    expect(enderecoCurto(p)).toBe('Rua Francisca Júlia, 215, Apto 72 · Santana, São Paulo/SP');
    expect(enderecoCompleto(p)).toBe('Rua Francisca Júlia, 215, Apto 72 · Santana, São Paulo/SP · CEP 02403-010');
    expect(enderecoCurto({ address: 'Rua A, 1' })).toBe('Rua A, 1');
    expect(formatarCep('02403010999')).toBe('02403-010');
  });
  it('vocativo cadastrado vence; sem ele, o primeiro nome', () => {
    expect(vocativo('Marília e Vitor', 'Marília Souza')).toBe('Marília e Vitor');
    expect(vocativo('  ', 'Marília Souza')).toBe('Marília');
  });
  it('cadastro e edição gravam os campos novos', () => {
    const db = harness();
    db().addProject({ code: 'X1', name: 'Casa X', clientName: 'Marília Souza', clientEmail: 'm@x.com', pass: '1234', ...p, greeting: 'Marília e Vitor', etapas: [] });
    const criado = db().projects().find((x) => x.code === 'X1');
    expect(criado).toMatchObject({ ...p, greeting: 'Marília e Vitor' });
    db().updateProject(criado.id, { code: 'X1', name: 'Casa X', ...p, city: 'Santos', greeting: '' });
    expect(db().projects().find((x) => x.code === 'X1')).toMatchObject({ city: 'Santos', greeting: '' });
  });
});

function EditorComEstado() {
  const [itens, setItens] = useState([
    { title: 'Briefing', category: 'Etapa', desc: '', subs: [{ title: 'Guia', kind: 'entrega', responsible: 'studio' }, { title: 'Reunião', kind: 'reuniao', responsible: 'studio' }] },
  ]);
  return (
    <>
      <EtapasEditor itens={itens} onChange={setItens} />
      <pre data-testid="estado">{JSON.stringify(itens)}</pre>
    </>
  );
}

describe('editor de templates', () => {
  it('sobe uma sub-etapa e aceita tipo escrito à mão', async () => {
    render(<EditorComEstado />);
    await userEvent.click(screen.getByLabelText('Subir sub-etapa 2'));
    let estado = JSON.parse(screen.getByTestId('estado').textContent);
    expect(estado[0].subs.map((b) => b.title)).toEqual(['Reunião', 'Guia']);
    await userEvent.selectOptions(screen.getAllByLabelText('Tipo da sub-etapa')[1], 'outro');
    await userEvent.type(screen.getByLabelText('Nome do tipo da sub-etapa'), 'Aprovação');
    estado = JSON.parse(screen.getByTestId('estado').textContent);
    expect(estado[0].subs[1]).toMatchObject({ kind: 'outro', kindLabel: 'Aprovação' });
  });
});

describe('linha do tempo', () => {
  const projeto = { id: 'p1' };
  const etapa = {
    id: 's9', projectId: 'p1', ord: 1, title: 'Briefing', category: 'Etapa', status: 'em_andamento', owner: 'studio', start: '', end: '',
    subs: [
      { id: 'b1', title: 'Escopo de projeto', kind: 'entrega', responsible: 'studio', due: '', done: false },
      { id: 'b2', title: 'Referências dos clientes', kind: 'entrega', responsible: 'cliente', due: '2026-01-10', done: false },
    ],
  };
  const fakeDb = () => ({
    stages: () => [etapa],
    templates: () => [],
    updateSub: vi.fn(async () => {}),
    moveSub: vi.fn(),
    toggleSub: vi.fn(),
    deleteSub: vi.fn(),
  });

  it('mostra só o que acrescenta: cliente como responsável e o prazo quando existe', () => {
    render(<Timeline db={fakeDb()} project={projeto} isStudio />);
    const [l1, l2] = screen.getAllByRole('listitem').filter((li) => li.classList.contains('sub'));
    // rodada 5: "Studio" e "Sem prazo" são o padrão e não aparecem;
    // rodada 6: tarefa do cliente em destaque e a data à direita
    expect(within(l1).queryByText('Studio')).toBeNull();
    expect(within(l1).queryByText('Sem prazo')).toBeNull();
    expect(within(l1).getByText('Entrega')).toBeTruthy();
    expect(within(l2).getByText('Tarefa do cliente')).toBeTruthy();
    expect(within(l2).getByText(/^Venceu 10\/01/)).toBeTruthy();
  });

  it('edita uma sub-etapa existente (não cria outra)', async () => {
    const db = fakeDb();
    render(<Timeline db={db} project={projeto} isStudio />);
    await userEvent.click(screen.getByLabelText('Editar Escopo de projeto'));
    const titulo = screen.getByDisplayValue('Escopo de projeto');
    await userEvent.clear(titulo);
    await userEvent.type(titulo, 'Escopo do projeto');
    await userEvent.type(screen.getByLabelText('Prazo'), '2026-11-05');
    await userEvent.click(screen.getByText('Salvar sub-etapa'));
    expect(db.updateSub).toHaveBeenCalledWith(
      's9',
      'b1',
      expect.objectContaining({ title: 'Escopo do projeto', kind: 'entrega', responsible: 'studio', due: '2026-11-05' }),
    );
  });

  it('cliente não vê os botões de mudar a sub-etapa', () => {
    render(<Timeline db={fakeDb()} project={projeto} isStudio={false} />);
    expect(screen.queryByLabelText('Editar Escopo de projeto')).toBeNull();
    expect(screen.queryByLabelText('Subir Referências dos clientes')).toBeNull();
  });
});
