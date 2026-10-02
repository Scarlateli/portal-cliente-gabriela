import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GerenciarProjeto } from './GerenciarProjeto.jsx';
import { EtapasEditor } from '../admin/EtapasEditor.jsx';
import { useState } from 'react';

const projeto = { id: 'p1', code: 'GL-07', name: 'Casa', address: '', start: '', due: '' };

describe('excluir projeto', () => {
  it('só libera a exclusão com o código do projeto digitado', async () => {
    const db = { deleteProject: vi.fn(async () => {}), updateProject: vi.fn() };
    const onExcluido = vi.fn();
    render(<GerenciarProjeto db={db} project={projeto} onExcluido={onExcluido} />);
    await userEvent.click(screen.getByText('Excluir projeto'));
    const botao = screen.getByText('Excluir definitivamente');
    expect(botao.disabled).toBe(true);
    await userEvent.type(screen.getByLabelText(/para confirmar a exclusão/i), 'GL-0');
    expect(botao.disabled).toBe(true);
    await userEvent.type(screen.getByLabelText(/para confirmar a exclusão/i), '7');
    expect(botao.disabled).toBe(false);
    await userEvent.click(botao);
    expect(db.deleteProject).toHaveBeenCalledWith('p1');
    expect(onExcluido).toHaveBeenCalled();
  });

  it('edita os dados e salva', async () => {
    const db = { deleteProject: vi.fn(), updateProject: vi.fn(async () => {}) };
    render(<GerenciarProjeto db={db} project={projeto} onExcluido={() => {}} />);
    await userEvent.click(screen.getByText('Editar dados do projeto'));
    const nome = screen.getByLabelText('Nome do projeto');
    await userEvent.clear(nome);
    await userEvent.type(nome, 'Casa Nova');
    await userEvent.click(screen.getByText('Salvar alterações'));
    expect(db.updateProject).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Casa Nova', code: 'GL-07' }));
  });
});

function EditorComEstado() {
  const [itens, setItens] = useState([]);
  return (
    <>
      <EtapasEditor itens={itens} onChange={setItens} />
      <pre data-testid="estado">{JSON.stringify(itens)}</pre>
    </>
  );
}

describe('editor de etapas', () => {
  it('monta etapa com sub-etapa de responsável cliente', async () => {
    render(<EditorComEstado />);
    await userEvent.click(screen.getByText('Adicionar etapa'));
    await userEvent.type(screen.getByLabelText('Título da etapa 1'), 'Briefing');
    await userEvent.click(screen.getByText('Sub-etapa'));
    await userEvent.type(screen.getByLabelText('Título da sub-etapa 1 da etapa 1'), 'Enviar plantas');
    await userEvent.selectOptions(screen.getByLabelText('Responsável pela sub-etapa'), 'cliente');
    const estado = JSON.parse(screen.getByTestId('estado').textContent);
    expect(estado[0].title).toBe('Briefing');
    expect(estado[0].subs[0]).toMatchObject({ title: 'Enviar plantas', responsible: 'cliente', kind: 'tarefa' });
  });
});
