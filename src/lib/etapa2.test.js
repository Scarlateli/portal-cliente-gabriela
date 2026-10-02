/* Etapa 2: templates com sub-etapas, template ajustado no cadastro do projeto,
   editar e excluir projeto (modo demonstração, que espelha o Supabase). */
import { describe, it, expect } from 'vitest';
import { makeDb } from './db.js';
import { seed } from './seed.js';

function harness() {
  let state = structuredClone(seed);
  const set = (fn) => {
    state = fn(state);
  };
  return () => makeDb(state, set);
}

const ITENS = [
  {
    title: 'Briefing',
    category: 'Reunião',
    desc: '',
    subs: [
      { title: 'Reunião inicial', kind: 'reuniao', responsible: 'studio' },
      { title: 'Enviar plantas do imóvel', kind: 'entrega', responsible: 'cliente' },
    ],
  },
  { title: 'Estudo preliminar', category: 'Entrega', desc: '', subs: [] },
  { title: '   ', category: 'Entrega', desc: '', subs: [] }, // vazia: ignorada
];

describe('Etapa 2', () => {
  it('cria o projeto já com as etapas e sub-etapas escolhidas no cadastro', () => {
    const db = harness();
    db().addProject({
      code: 'E2-1', name: 'Casa Etapa 2', address: '', start: '2026-10-01', due: '',
      clientName: 'Cliente', clientEmail: 'cliente@teste.com', pass: '1234', etapas: ITENS,
    });
    const p = db().projects().find((x) => x.code === 'E2-1');
    const etapas = db().stages(p.id);
    expect(etapas.map((e) => e.title)).toEqual(['Briefing', 'Estudo preliminar']);
    expect(etapas[0].subs.map((b) => [b.title, b.kind, b.responsible])).toEqual([
      ['Reunião inicial', 'reuniao', 'studio'],
      ['Enviar plantas do imóvel', 'entrega', 'cliente'],
    ]);
  });

  it('template guarda sub-etapas e as aplica no projeto', () => {
    const db = harness();
    db().addTemplate('Interiores', ITENS);
    const t = db().templates().find((x) => x.name === 'Interiores');
    const antes = db().stages('p2').length;
    db().applyTemplate('p2', t.id);
    const novas = db().stages('p2').slice(antes);
    expect(novas[0].subs).toHaveLength(2);
    expect(novas[0].subs[1].responsible).toBe('cliente');
  });

  it('edita um template sem criar outro', () => {
    const db = harness();
    db().addTemplate('Base', ITENS);
    const t = db().templates().find((x) => x.name === 'Base');
    const total = db().templates().length;
    db().updateTemplate(t.id, 'Base revisada', [{ title: 'Só uma', category: 'Entrega', desc: '', subs: [] }]);
    const depois = db().templates().find((x) => x.id === t.id);
    expect(db().templates()).toHaveLength(total);
    expect(depois.name).toBe('Base revisada');
    expect(depois.items.map((i) => i.title)).toEqual(['Só uma']);
  });

  it('edita os dados do projeto', () => {
    const db = harness();
    const p = db().projects()[0];
    db().updateProject(p.id, { code: 'NOVO-1', name: 'Nome novo', address: 'Rua B', start: '2026-02-01', due: '2026-12-01' });
    const depois = db().projects().find((x) => x.id === p.id);
    expect([depois.code, depois.name, depois.due]).toEqual(['NOVO-1', 'Nome novo', '2026-12-01']);
  });

  it('exclui o projeto e tudo que pertence a ele, sem tocar nos outros', () => {
    const db = harness();
    const [alvo, outro] = db().projects();
    const etapasDoOutro = db().stages(outro.id).length;
    db().deleteProject(alvo.id);
    expect(db().projects().some((x) => x.id === alvo.id)).toBe(false);
    expect(db().stages(alvo.id)).toHaveLength(0);
    expect(db().contracts(alvo.id)).toHaveLength(0);
    expect(db().stages(outro.id)).toHaveLength(etapasDoOutro);
  });
});
