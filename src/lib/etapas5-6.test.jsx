/* Etapas 5 e 6: o cliente responde a documentos, termos e contratos.
   Regras no banco de demonstração (espelho das funções do Supabase) e as
   telas do cliente e do studio. */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { makeDb } from './db.js';
import { seed } from './seed.js';
import { Documents } from '../components/project/Documents.jsx';
import { Contract } from '../components/project/Contract.jsx';

function harness() {
  let state = structuredClone(seed);
  const set = (fn) => {
    state = fn(state);
  };
  return () => makeDb(state, set);
}

// componente com estado de verdade, para a tela reagir às mutações
function ComEstado({ Aba, isStudio }) {
  const [state, setState] = useState(() => structuredClone(seed));
  const db = makeDb(state, setState);
  return <Aba db={db} project={db.project('p1')} isStudio={isStudio} />;
}

describe('Etapa 5 — documentos (regras)', () => {
  it('OK do cliente registra quem e quando, e não aceita resposta dupla', () => {
    const db = harness();
    db().setDocumentApproval('d1', 'ok');
    db().responderDocumento('d1');
    const d = db().documents('p1').find((x) => x.id === 'd1');
    expect(d.response).toBe('aprovado');
    expect(d.respondedName).toBe('Vanessa Tamura');
    expect(() => db().responderDocumento('d1')).toThrow(/já foi respondido/);
  });

  it('assinatura exige nome completo', () => {
    const db = harness();
    expect(() => db().responderDocumento('d3', ' ')).toThrow(/nome completo/);
    db().responderDocumento('d3', 'Vanessa Tamura');
    expect(db().documents('p1').find((x) => x.id === 'd3').response).toBe('assinado');
  });

  it('documento sem pedido não aceita resposta; pedir de novo zera a resposta', () => {
    const db = harness();
    expect(() => db().responderDocumento('d1')).toThrow(/não pede resposta/);
    db().setDocumentApproval('d2', 'assinatura');
    expect(db().documents('p1').find((x) => x.id === 'd2').response).toBeNull();
  });
});

describe('Etapa 6 — termos e contratos (regras)', () => {
  it('termo: recusa guarda o motivo; studio libera de novo; cliente aprova', () => {
    const db = harness();
    db().responderContrato('c3', 'recusar', null, 'Prefiro não aparecer nas fotos');
    let c = db().contracts('p1').find((x) => x.id === 'c3');
    expect([c.sigStatus, c.responseNote]).toEqual(['recusado', 'Prefiro não aparecer nas fotos']);
    db().setContract('c3', { sigStatus: 'enviado', responseNote: null });
    db().responderContrato('c3', 'aprovar');
    c = db().contracts('p1').find((x) => x.id === 'c3');
    expect([c.sigStatus, c.signer]).toEqual(['assinado', 'Vanessa Tamura']);
  });

  it('contrato da Autentique não pode ser "assinado" pelo portal', () => {
    const db = harness();
    expect(() => db().responderContrato('c1', 'assinar', 'Vanessa Tamura')).toThrow(/não permitida/);
  });

  it('contrato pelo portal: liberar e assinar com nome', () => {
    const db = harness();
    db().addContractDoc('p1', { name: 'Aditivo', kind: 'contrato', method: 'portal', body: 'Texto do aditivo' });
    const novo = db().contracts('p1').find((x) => x.name === 'Aditivo');
    expect(() => db().responderContrato(novo.id, 'assinar', 'Vanessa Tamura')).toThrow(/não está aguardando/);
    db().setContract(novo.id, { sigStatus: 'enviado', provider: 'Portal' });
    db().responderContrato(novo.id, 'assinar', 'Vanessa Tamura');
    expect(db().contracts('p1').find((x) => x.id === novo.id).sigStatus).toBe('assinado');
  });
});

describe('Etapas 5 e 6 — telas', () => {
  it('cliente assina documento pela tela', async () => {
    render(<ComEstado Aba={Documents} isStudio={false} />);
    expect(screen.getByText('Aguardando assinatura do cliente')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /assinar/i }));
    await userEvent.type(screen.getByLabelText('Nome completo para a assinatura'), 'Vanessa Tamura');
    const botao = screen.getAllByRole('button', { name: /assinar/i }).pop();
    expect(botao.disabled).toBe(true); // falta marcar "li e concordo"
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(botao);
    expect(await screen.findByText(/Assinado por Vanessa Tamura/)).toBeTruthy();
  });

  it('cliente lê o termo e recusa com motivo', async () => {
    render(<ComEstado Aba={Contract} isStudio={false} />);
    expect(screen.getByText(/Autorizo o studio/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /recusar/i }));
    await userEvent.type(screen.getByLabelText(/motivo/i), 'Não quero fotos');
    await userEvent.click(screen.getByRole('button', { name: /confirmar recusa/i }));
    expect(await screen.findByText(/Você recusou este documento/)).toBeTruthy();
  });

  it('studio vê o motivo da recusa e pode liberar de novo', async () => {
    function Cenario() {
      const [state, setState] = useState(() => {
        const s = structuredClone(seed);
        s.contracts = s.contracts.map((c) => (c.id === 'c3' ? { ...c, sigStatus: 'recusado', responseNote: 'Não quero fotos' } : c));
        return s;
      });
      const db = makeDb(state, setState);
      return <Contract db={db} project={db.project('p1')} isStudio />;
    }
    render(<Cenario />);
    expect(screen.getByText('Não quero fotos')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /liberar novamente/i }));
    expect(await screen.findByText(/Aguardando aprovação do cliente/)).toBeTruthy();
  });
});
