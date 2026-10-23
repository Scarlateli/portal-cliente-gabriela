/* Rodada 12 (feedback da Gabriela, 23/10). */
import { describe, it, expect } from 'vitest';
import { makeDb } from './db.js';
import { seed } from './seed.js';
import { newProjectSchema, validate } from './validation.js';

const harness = () => {
  let state = structuredClone(seed);
  return () => makeDb(state, (fn) => (state = fn(state)));
};

describe('projeto sem e-mail, acesso liberado depois', () => {
  it('o cadastro aceita e-mail em branco, mas não e-mail inválido', () => {
    const base = { code: 'X1', name: 'Casa', clientName: 'Família X', pass: '1234' };
    expect(validate(newProjectSchema, { ...base, clientEmail: '' }).ok).toBe(true);
    expect(validate(newProjectSchema, { ...base, clientEmail: 'nao-e-email' }).ok).toBe(false);
  });
  it('nasce sem cliente e ganha o acesso ao informar o e-mail', () => {
    const db = harness();
    db().addProject({ code: 'X1', name: 'Casa', clientName: 'Família X', clientEmail: '', pass: '1234', etapas: [] });
    const p = db().projects().find((x) => x.code === 'X1');
    expect(p.clientId).toBeNull();
    expect(db().clientName(p.id)).toBe('Família X');
    const r = db().liberarAcesso(p.id, ' Familia@X.com ');
    expect(r).toMatchObject({ email: 'familia@x.com', jaTinhaAcesso: false });
    const depois = db().projects().find((x) => x.code === 'X1');
    expect(depois.clientId).toBeTruthy();
    expect(db().projectsForClient(depois.clientId).map((x) => x.code)).toContain('X1');
    expect(() => db().liberarAcesso(p.id, 'outro@x.com')).toThrow(/já tem acesso/);
  });
});
