import { describe, it, expect } from 'vitest';
import { linkGoogleAgenda } from './agenda.js';

const params = (url) => Object.fromEntries(new URL(url).searchParams);

describe('linkGoogleAgenda', () => {
  it('reunião com horário vira compromisso de 1 hora em São Paulo', () => {
    const p = params(linkGoogleAgenda({ title: 'Reunião de briefing', date: '2026-10-08', time: '14:30', link: 'https://meet.google.com/abc', projeto: 'Casa Teste' }));
    expect(p.dates).toBe('20261008T143000/20261008T153000');
    expect(p.ctz).toBe('America/Sao_Paulo');
    expect(p.details).toContain('https://meet.google.com/abc');
    expect(p.details).toContain('Casa Teste');
  });
  it('sem horário vira evento de dia inteiro, inclusive na virada do mês', () => {
    expect(params(linkGoogleAgenda({ title: 'Entrega', date: '2026-10-31' })).dates).toBe('20261031/20261101');
  });
  it('horário tarde da noite não passa para o dia seguinte', () => {
    expect(params(linkGoogleAgenda({ title: 'X', date: '2026-10-08', time: '23:30' })).dates).toBe('20261008T233000/20261008T235900');
  });
  it('sem data não gera link', () => {
    expect(linkGoogleAgenda({ title: 'X' })).toBeNull();
  });
});
