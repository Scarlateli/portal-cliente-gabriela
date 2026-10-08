/* Etapa 8: cadastro de fornecedores e pedido de negociação. */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { makeDb } from './db.js';
import { seed } from './seed.js';
import { Quotes } from '../components/project/Quotes.jsx';
import { Fornecedores } from '../components/admin/Fornecedores.jsx';

function harness() {
  let state = structuredClone(seed);
  const set = (fn) => {
    state = fn(state);
  };
  return () => makeDb(state, set);
}

describe('Etapa 8 — regras', () => {
  it('cliente pede negociação com mensagem; studio reenvia; cliente aprova', () => {
    const db = harness();
    expect(() => db().decidirOrcamento('q1', 'negociar', '  ')).toThrow(/negociar/);
    db().decidirOrcamento('q1', 'negociar', 'Dá para parcelar em 3x?');
    let q = db().quotes('p1').find((x) => x.id === 'q1');
    expect(q.status).toBe('negociacao');
    expect(q.comments.at(-1)).toMatchObject({ author: 'client', body: 'Dá para parcelar em 3x?' });
    expect(() => db().decidirOrcamento('q1', 'aprovar')).toThrow(/não está aguardando/);
    db().updateQuote('q1', { amount: 29000, status: 'pendente' });
    db().decidirOrcamento('q1', 'aprovar');
    q = db().quotes('p1').find((x) => x.id === 'q1');
    expect([q.status, q.amount]).toEqual(['aprovado', 29000]);
  });

  it('cadastro de fornecedores: incluir, editar, remover', () => {
    const db = harness();
    db().addFornecedor({ name: '  Vidraçaria Azul ', segment: 'Vidraçaria' });
    const f = db().fornecedores().find((x) => x.name === 'Vidraçaria Azul');
    expect(f).toBeTruthy();
    db().updateFornecedor(f.id, { ...f, phone: '(11) 9999-0000' });
    expect(db().fornecedores().find((x) => x.id === f.id).phone).toBe('(11) 9999-0000');
    db().deleteFornecedor(f.id);
    expect(db().fornecedores().some((x) => x.id === f.id)).toBe(false);
  });
});

function Aba({ Comp, isStudio }) {
  const [state, setState] = useState(() => structuredClone(seed));
  const db = makeDb(state, setState);
  return <Comp db={db} project={db.project('p1')} isStudio={isStudio} />;
}

describe('Etapa 8 — telas', () => {
  it('cliente pede negociação pela tela', async () => {
    render(<Aba Comp={Quotes} isStudio={false} />);
    await userEvent.click(screen.getAllByRole('button', { name: /pedir negociação/i })[0]);
    await userEvent.type(screen.getByLabelText(/o que você gostaria de negociar/i), 'Valor acima do previsto');
    await userEvent.click(screen.getByRole('button', { name: /enviar pedido/i }));
    expect(await screen.findByText(/Você pediu uma negociação/)).toBeTruthy();
    expect(screen.getByText('Valor acima do previsto')).toBeTruthy();
  });

  it('studio escolhe fornecedor cadastrado e os dados vêm preenchidos', async () => {
    render(<Aba Comp={Quotes} isStudio />);
    await userEvent.click(screen.getByRole('button', { name: /novo orçamento/i }));
    await userEvent.selectOptions(screen.getByLabelText(/fornecedor cadastrado/i), 'f1');
    expect(screen.getByLabelText('Nome do fornecedor').value).toBe('Marcenaria Bianchi');
    expect(screen.getByLabelText('Contato do fornecedor').value).toContain('(11) 98888-1111');
  });

  it('aba de fornecedores cadastra um novo', async () => {
    function Painel() {
      const [state, setState] = useState(() => structuredClone(seed));
      return <Fornecedores db={makeDb(state, setState)} />;
    }
    render(<Painel />);
    await userEvent.click(screen.getByRole('button', { name: /cadastrar fornecedor/i }));
    await userEvent.type(screen.getByLabelText('Nome do fornecedor'), 'Tapeçaria Norte');
    await userEvent.click(screen.getByRole('button', { name: /^cadastrar$/i }));
    expect(await screen.findByText('Tapeçaria Norte')).toBeTruthy();
  });
});
