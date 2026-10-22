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
