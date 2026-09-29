import { describe, it, expect } from 'vitest';
import { erroAmigavel } from './erros.js';

describe('erroAmigavel', () => {
  it('traduz falta de conexão', () => {
    const r = erroAmigavel(new TypeError('Failed to fetch'));
    expect(r.texto).toMatch(/sem conexão/i);
    expect(r.detalhe).toBe('Failed to fetch');
  });

  it('traduz bloqueio de permissão (RLS)', () => {
    const r = erroAmigavel({ message: 'new row violates row-level security policy for table "stages"' });
    expect(r.texto).toMatch(/permissão/i);
  });

  it('traduz sessão expirada', () => {
    expect(erroAmigavel({ message: 'JWT expired' }).texto).toMatch(/sessão expirou/i);
  });

  it('traduz arquivo grande demais', () => {
    expect(erroAmigavel({ message: 'The object exceeded the maximum allowed size' }).texto).toMatch(/20 MB/);
  });

  it('mantém mensagem que já está em português, sem detalhe repetido', () => {
    const r = erroAmigavel(new Error('anexe o PDF do contrato antes de enviar'));
    expect(r.texto).toBe('Anexe o PDF do contrato antes de enviar');
    expect(r.detalhe).toBeNull();
  });

  it('esconde erro técnico desconhecido atrás de frase genérica', () => {
    const r = erroAmigavel({ message: 'PGRST116: JSON object requested, multiple rows returned' });
    expect(r.texto).toMatch(/não foi possível concluir/i);
    expect(r.detalhe).toMatch(/PGRST116/);
  });

  it('não quebra com erro vazio', () => {
    expect(erroAmigavel(null).texto).toMatch(/algo deu errado/i);
  });
});
