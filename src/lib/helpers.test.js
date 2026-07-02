import { describe, it, expect } from 'vitest';
import { fmt, money, addMonthsISO, stageOverdue, subStats } from './helpers.js';

describe('helpers', () => {
  it('fmt converte ISO para dd/mm/aaaa ou em dash', () => {
    expect(fmt('2026-06-28')).toBe('28/06/2026');
    expect(fmt('')).toBe('—');
    expect(fmt('-')).toBe('—');
  });

  it('money formata em BRL', () => {
    expect(money(1234.5)).toBe('R$ 1.234,50');
    expect(money(0)).toBe('R$ 0,00');
    expect(money(null)).toBe('R$ 0,00');
  });

  it('addMonthsISO soma meses (datas no meio do mês são estáveis)', () => {
    expect(addMonthsISO('2026-01-15', 2)).toBe('2026-03-15');
    expect(addMonthsISO('2026-06-10', 0)).toBe('2026-06-10');
  });

  it('addMonthsISO prende o dia ao fim do mês (parcelas no dia 29-31)', () => {
    expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsISO('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsISO('2026-08-31', 1)).toBe('2026-09-30');
    expect(addMonthsISO('2026-01-31', 3)).toBe('2026-04-30');
  });

  it('stageOverdue só é true para etapa do cliente vencida e não concluída', () => {
    expect(stageOverdue({ owner: 'client', status: 'em_andamento', end: '2000-01-01' })).toBe(true);
    expect(stageOverdue({ owner: 'studio', status: 'em_andamento', end: '2000-01-01' })).toBe(false);
    expect(stageOverdue({ owner: 'client', status: 'concluida', end: '2000-01-01' })).toBe(false);
    expect(stageOverdue({ owner: 'client', status: 'em_andamento', end: '' })).toBe(false);
  });

  it('subStats conta sub-etapas concluídas', () => {
    expect(subStats({ subs: [{ done: true }, { done: false }] })).toEqual({ total: 2, done: 1 });
    expect(subStats({})).toEqual({ total: 0, done: 0 });
  });
});
