import { describe, it, expect, vi } from 'vitest';

describe('compatível com a CSP do portal', () => {
  it('validar formulários não tenta compilar código (new Function)', async () => {
    const original = globalThis.Function;
    const espiao = vi.fn(function () {
      throw new EvalError('bloqueado pela CSP');
    });
    globalThis.Function = espiao;
    try {
      const { loginSchema, newProjectSchema, validate } = await import('./validation.js');
      expect(validate(loginSchema, { email: 'a@b.com', pass: 'x' }).ok).toBe(true);
      expect(validate(newProjectSchema, { code: '', name: '', clientName: '', clientEmail: 'x' }).ok).toBe(false);
    } finally {
      globalThis.Function = original;
    }
    expect(espiao).not.toHaveBeenCalled();
  });
});
