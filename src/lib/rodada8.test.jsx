/* Rodada 8 (visão do cliente, 22/10): comentário ao aprovar um documento
   e "Envio validado pelo studio." nos Envios do Cliente. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeDb } from './db.js';
import { seed } from './seed.js';
import { Documents } from '../components/project/Documents.jsx';
import { EnviosCliente } from '../components/project/EnviosCliente.jsx';

const ata = { id: 'd1', name: 'Ata 1', type: 'ata', size: '1 MB', date: '2026-10-20', approval: 'ok', response: null };
const montarDocs = (d, isStudio = false) => {
  const db = { stages: () => [], documents: () => [d], responderDocumento: vi.fn(async () => {}) };
  render(<Documents db={db} project={{ id: 'p1' }} isStudio={isStudio} />);
  return db;
};

describe('comentário ao responder um documento', () => {
  it('aprova com comentário', async () => {
    const db = montarDocs(ata);
    await userEvent.type(screen.getByLabelText('Comentário para o studio'), 'Tudo certo, obrigado!');
    await userEvent.click(screen.getByRole('button', { name: /Aprovo/ }));
    expect(db.responderDocumento).toHaveBeenCalledWith('d1', null, 'confirmar', 'Tudo certo, obrigado!');
  });

  it('aprova sem comentário', async () => {
    const db = montarDocs(ata);
    await userEvent.click(screen.getByRole('button', { name: /Aprovo/ }));
    expect(db.responderDocumento).toHaveBeenCalledWith('d1', null, 'confirmar', null);
  });

  it('o comentário já escrito vai para o pedido de ajustes', async () => {
    const db = montarDocs(ata);
    await userEvent.type(screen.getByLabelText('Comentário para o studio'), 'Faltou a cozinha');
    await userEvent.click(screen.getByRole('button', { name: /Pedir ajustes/ }));
    await userEvent.click(screen.getByText('Enviar pedido de ajustes'));
    expect(db.responderDocumento).toHaveBeenCalledWith('d1', null, 'ajustes', 'Faltou a cozinha');
  });

  it('studio e cliente veem o comentário deixado na aprovação', () => {
    montarDocs({ ...ata, response: 'aprovado', respondedName: 'Maria', respondedAt: '2026-10-22T10:00:00Z', responseNote: 'Tudo certo' }, true);
    expect(screen.getByText(/Comentário do cliente: “Tudo certo”/)).toBeTruthy();
  });

  it('banco de demonstração guarda o comentário (como o Supabase)', () => {
    let state = structuredClone(seed);
    const db = () => makeDb(state, (fn) => (state = fn(state)));
    db().setDocumentApproval('d2', 'ok'); // pede a aprovação de novo
    db().responderDocumento('d2', null, 'confirmar', '  Ok!  ');
    expect(state.documents.find((x) => x.id === 'd2')).toMatchObject({ response: 'aprovado', responseNote: 'Ok!' });
  });
});

describe('Envios do Cliente', () => {
  it('pedido conferido aparece como "Envio validado pelo studio."', () => {
    const db = {
      stages: () => [{ id: 's1', title: 'Briefing', status: 'em_andamento', subs: [{ id: 'b1', title: 'Referências', responsible: 'cliente', done: true, pedeArquivos: true }] }],
      subArquivos: () => [],
    };
    render(<EnviosCliente db={db} project={{ id: 'p1' }} isStudio={false} />);
    expect(screen.getByText(/Envio validado pelo studio\./)).toBeTruthy();
    expect(screen.getByText(/Aqui ficam todos os arquivos que solicitamos a você/)).toBeTruthy();
  });
});
