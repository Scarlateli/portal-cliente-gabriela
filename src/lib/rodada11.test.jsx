/* Rodada 11 (validação da Gabriela, 22/10 à tarde). */
import { describe, it, expect } from 'vitest';
import { queryClient } from './queryClient.js';

describe('telas do studio e do cliente se atualizam sozinhas', () => {
  it('busca de novo ao voltar para a aba e periodicamente', () => {
    const o = queryClient.getDefaultOptions().queries;
    expect(o.refetchOnWindowFocus).toBe(true);
    expect(o.refetchInterval).toBeGreaterThan(0);
    expect(o.refetchInterval).toBeLessThanOrEqual(60_000);
    expect(o.refetchIntervalInBackground).toBe(false);
  });
});

import { render, screen } from '@testing-library/react';
import { makeDb } from './db.js';
import { seed } from './seed.js';
import { textosComprovante } from './comprovante.js';
import { Contract } from '../components/project/Contract.jsx';

describe('aprovar a etapa gera o termo em Contratos e Termos', () => {
  it('no banco de demonstração (igual ao Supabase)', () => {
    let state = structuredClone(seed);
    const db = () => makeDb(state, (fn) => (state = fn(state)));
    const antes = db().contracts('p1').length;
    db().pedirAprovacaoEtapa('s1');
    db().responderEtapa('s1', 'aprovar', 'Vanessa Tamura', 'Perfeito');
    const novos = db().contracts('p1').slice(antes);
    expect(novos).toHaveLength(1);
    expect(novos[0]).toMatchObject({ stageId: 's1', kind: 'termo', sigStatus: 'assinado', signer: 'Vanessa Tamura', responseNote: 'Perfeito' });
    expect(novos[0].name).toMatch(/^Termo de Aprovação – /);
  });

  it('pedir ajustes não gera termo', () => {
    let state = structuredClone(seed);
    const db = () => makeDb(state, (fn) => (state = fn(state)));
    const antes = db().contracts('p1').length;
    db().pedirAprovacaoEtapa('s1');
    db().responderEtapa('s1', 'ajustes', null, 'Trocar a cor');
    expect(db().contracts('p1')).toHaveLength(antes);
  });

  it('o comprovante diz que foi na Linha do Tempo e traz o comentário', () => {
    const t = textosComprovante({
      contrato: { id: 'c9', stageId: 's1', kind: 'termo', method: 'aceite', name: 'Termo de Aprovação – BRIEFING', signer: 'Maria', respondedAt: '2026-10-22T13:00:00Z', responseNote: 'Perfeito' },
      projeto: { name: 'Casa' },
      cliente: 'Maria',
    });
    expect(t.titulo).toBe('Comprovante de aprovação de etapa');
    expect(t.declaracao).toMatch(/^Aprovado por Maria em 22\/10\/2026, às 10:00 .*Linha do Tempo.*nome completo/);
    expect(t.campos).toContainEqual(['Comentário', 'Perfeito']);
  });

  it('o studio pode editar o termo da etapa mesmo aprovado', () => {
    const termo = { id: 'c9', projectId: 'p1', stageId: 's1', kind: 'termo', method: 'aceite', name: 'Termo de Aprovação – BRIEFING', body: 'x', sigStatus: 'assinado', provider: 'Portal', signer: 'Maria', signedAt: '2026-10-22' };
    const outro = { ...termo, id: 'c8', stageId: null, name: 'Outro termo' };
    render(<Contract db={{ contracts: () => [termo, outro], clientName: () => 'Maria', checkAutentique: () => {} }} project={{ id: 'p1' }} isStudio />);
    expect(screen.getAllByText('Editar')).toHaveLength(1);
    expect(screen.getByText(/gerado na aprovação da etapa/)).toBeTruthy();
  });
});
