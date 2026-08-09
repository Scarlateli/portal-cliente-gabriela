/* Regressão: a tela precisa refletir as ações NA HORA, sem trocar de aba.
   Já quebrou duas vezes (invalidação sem refetch, e observador sem 'data'),
   então o comportamento fica travado por teste no modo supabase. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.stubEnv('VITE_DATA_SOURCE', 'supabase');
const { useResolvedDb, specsFor } = await import('./useResolvedDb.js');
const { qk, IS_SUPABASE } = await import('./data.js');

const PID = 'p1';

function envolve(ui) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function TelaContratos({ baseDb }) {
  const r = useResolvedDb(
    baseDb,
    specsFor(baseDb, [{ key: qk.contracts(PID), method: 'contracts', args: [PID] }]),
    PID,
  );
  if (!r.ready) return <span data-testid="lista">carregando</span>;
  const lista = r.db.contracts(PID) || [];
  return (
    <div>
      <span data-testid="lista">{lista.map((c) => c.id).join(',')}</span>
      <button onClick={() => r.db.deleteContractDoc(PID, 'c1')}>excluir</button>
    </div>
  );
}

function TelaDocumentos({ baseDb }) {
  const r = useResolvedDb(
    baseDb,
    specsFor(baseDb, [{ key: qk.documents(PID), method: 'documents', args: [PID] }]),
    PID,
  );
  if (!r.ready) return <span data-testid="lista">carregando</span>;
  const lista = r.db.documents(PID) || [];
  return (
    <div>
      <span data-testid="lista">{lista.map((d) => d.name).join(',')}</span>
      <button onClick={() => r.db.addDocument(PID, { name: 'novo.pdf' })}>adicionar</button>
    </div>
  );
}

describe('reatividade no modo supabase', () => {
  it('o modo supabase está ativo neste arquivo', () => {
    expect(IS_SUPABASE).toBe(true);
  });

  it('excluir um contrato some da tela na hora', async () => {
    let estado = [
      { id: 'c1', projectId: PID },
      { id: 'c2', projectId: PID },
    ];
    const baseDb = {
      contracts: async () => estado,
      deleteContractDoc: async (_pid, cid) => {
        estado = estado.filter((c) => c.id !== cid);
      },
    };
    envolve(<TelaContratos baseDb={baseDb} />);
    await waitFor(() => expect(screen.getByTestId('lista').textContent).toBe('c1,c2'));
    await userEvent.click(screen.getByText('excluir'));
    await waitFor(() => expect(screen.getByTestId('lista').textContent).toBe('c2'), { timeout: 3000 });
  });

  it('adicionar um documento aparece na tela na hora', async () => {
    const estado = [{ id: 'd1', name: 'planta.pdf' }];
    const baseDb = {
      documents: async () => [...estado],
      addDocument: async (_pid, d) => {
        estado.push({ id: 'd2', name: d.name });
      },
    };
    envolve(<TelaDocumentos baseDb={baseDb} />);
    await waitFor(() => expect(screen.getByTestId('lista').textContent).toBe('planta.pdf'));
    await userEvent.click(screen.getByText('adicionar'));
    await waitFor(() => expect(screen.getByTestId('lista').textContent).toBe('planta.pdf,novo.pdf'), {
      timeout: 3000,
    });
  });
});
