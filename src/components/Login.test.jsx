/* A porta de entrada do portal: login pelo formulário e recuperação de
   senha na própria tela. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.stubEnv('VITE_DATA_SOURCE', 'supabase');
const invoke = vi.fn(async () => ({ data: { ok: true } }));
vi.mock('../lib/supabase/client.js', async (original) => ({
  ...(await original()),
  loadSupabase: async () => ({ functions: { invoke } }),
}));
const { Login } = await import('./Login.jsx');

describe('Login', () => {
  it('entra pelo Enter no campo de senha (formulário de verdade)', async () => {
    const onLogin = vi.fn();
    const db = { login: vi.fn(async () => ({ id: 'u1' })) };
    render(<Login db={db} onLogin={onLogin} />);
    await userEvent.type(screen.getByLabelText('E-mail'), 'cliente@teste.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'senhaforte123{Enter}');
    await waitFor(() => expect(onLogin).toHaveBeenCalled());
    expect(db.login).toHaveBeenCalledWith('cliente@teste.com', 'senhaforte123');
  });

  it('avisa quando a senha está errada', async () => {
    const db = { login: vi.fn(async () => null) };
    render(<Login db={db} onLogin={() => {}} />);
    await userEvent.type(screen.getByLabelText('E-mail'), 'cliente@teste.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'errada123{Enter}');
    expect(await screen.findByText(/e-mail ou senha incorretos/i)).toBeTruthy();
  });

  it('recupera a senha na própria tela, sem caixa do navegador', async () => {
    const prompt = vi.spyOn(window, 'prompt');
    render(<Login db={{ login: vi.fn() }} onLogin={() => {}} />);
    await userEvent.click(screen.getByText('Esqueci minha senha'));
    expect(screen.getByText('Recuperar senha')).toBeTruthy();
    await userEvent.type(screen.getByLabelText('E-mail cadastrado'), 'cliente@teste.com');
    await userEvent.click(screen.getByText('Enviar link'));
    expect(await screen.findByText(/confira também a caixa de spam/i)).toBeTruthy();
    expect(invoke).toHaveBeenCalledWith('forgot-password', { body: { email: 'cliente@teste.com' } });
    expect(prompt).not.toHaveBeenCalled();
    await userEvent.click(screen.getByText('Voltar para o login'));
    expect(screen.getByText('Portal do projeto')).toBeTruthy();
  });

  it('pede o e-mail antes de enviar o link', async () => {
    render(<Login db={{ login: vi.fn() }} onLogin={() => {}} />);
    await userEvent.click(screen.getByText('Esqueci minha senha'));
    await userEvent.click(screen.getByText('Enviar link'));
    expect(await screen.findByText(/digite o e-mail cadastrado/i)).toBeTruthy();
  });
});
