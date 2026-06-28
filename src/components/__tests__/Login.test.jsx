import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Login } from '../Login.jsx';

const fakeDb = {
  login: (e, p) =>
    e === 'studio@demo.com' && p === '1234' ? { id: 'g1', role: 'studio', name: 'Gabriela' } : null,
};

describe('Login', () => {
  it('mostra erro de validação quando os campos estão vazios', async () => {
    render(<Login db={fakeDb} onLogin={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));
    expect(await screen.findByText(/informe seu e-mail/i)).toBeInTheDocument();
  });

  it('chama onLogin com credenciais válidas', async () => {
    const onLogin = vi.fn();
    render(<Login db={fakeDb} onLogin={onLogin} />);
    await userEvent.type(screen.getByPlaceholderText(/seu e-mail/i), 'studio@demo.com');
    await userEvent.type(screen.getByPlaceholderText(/senha/i), '1234');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() => expect(onLogin).toHaveBeenCalledTimes(1));
  });
});
