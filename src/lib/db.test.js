import { describe, it, expect } from 'vitest';
import { makeDb } from './db.js';
import { seed } from './seed.js';

/* Harness mínimo simulando o useState do App: cada db() pega o estado atual. */
function makeHarness() {
  let state = structuredClone(seed);
  const set = (updater) => { state = updater(state); };
  const db = () => makeDb(state, set);
  return { db };
}

describe('makeDb (mock)', () => {
  it('addProject cria cliente, projeto e contrato', () => {
    const { db } = makeHarness();
    const before = db().projects().length;
    db().addProject({ code: 'X-1', name: 'Casa Teste', address: 'Rua A', start: '2026-01-01', due: '', clientName: 'Fulano', clientEmail: 'F@Email.com', pass: '1234' });
    const projects = db().projects();
    expect(projects.length).toBe(before + 1);
    const p = projects[projects.length - 1];
    expect(p.code).toBe('X-1');
    expect(db().clientName(p.id)).toBe('Fulano');
    expect(db().contract(p.id)).toBeTruthy();
  });

  it('applyTemplate adiciona as etapas do template', () => {
    const { db } = makeHarness();
    const before = db().stages('p2').length;
    db().applyTemplate('p2', 't1');
    expect(db().stages('p2').length).toBe(before + 6);
  });

  it('markPaid marca a parcela como paga', () => {
    const { db } = makeHarness();
    db().markPaid('p1', 3);
    const inst = db().payment('p1').installments.find((i) => i.n === 3);
    expect(inst.status).toBe('pago');
    expect(inst.paidAt).toBeTruthy();
  });

  it('setQuoteStatus aprova e o orçamento vira fornecedor contratado', () => {
    const { db } = makeHarness();
    db().setQuoteStatus('q1', 'aprovado');
    expect(db().quotes('p1').find((q) => q.id === 'q1').status).toBe('aprovado');
    expect(db().suppliers('p1').some((q) => q.id === 'q1')).toBe(true);
  });
});
