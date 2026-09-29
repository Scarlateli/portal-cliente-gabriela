import { useState } from 'react';
import { loadSupabase } from '../lib/supabase/client.js';
import { Mail, Lock } from 'lucide-react';

import { STUDIO } from '../lib/constants.js';
import { loginSchema, validate } from '../lib/validation.js';
import { IS_SUPABASE } from '../lib/data.js';

export function Login({ db, onLogin }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [fieldErr, setFieldErr] = useState({});
  const [busy, setBusy] = useState(false);
  // recuperação de senha na própria tela (antes era uma caixa cinza do
  // navegador, que no celular e em navegadores embutidos fica ruim)
  const [recuperando, setRecuperando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const submit = async () => {
    const { ok, errors } = validate(loginSchema, { email, pass });
    if (!ok) {
      setFieldErr(errors);
      setErr('');
      return;
    }
    setFieldErr({});
    setBusy(true);
    try {
      const u = await db.login(email, pass);
      if (u) {
        setErr('');
        onLogin(u);
      } else {
        setErr('E-mail ou senha incorretos. Confira os dados de acesso.');
      }
    } catch {
      setErr('Não foi possível entrar agora. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const enviarLink = async () => {
    const alvo = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(alvo)) {
      setErr('Digite o e-mail cadastrado para receber o link.');
      return;
    }
    setErr('');
    setBusy(true);
    try {
      const sb = await loadSupabase();
      await sb.functions.invoke('forgot-password', { body: { email: alvo } });
    } catch {
      /* a resposta é sempre neutra, por segurança: não revelamos se o
         e-mail existe na base */
    } finally {
      setBusy(false);
      setEnviado(true);
    }
  };

  const voltarAoLogin = () => {
    setRecuperando(false);
    setEnviado(false);
    setErr('');
  };

  return (
    <div className="login login-split">
      <aside className="login-brand">
        <div className="login-brand-inner">
          <p className="lb-word">Gabriela Lendecker</p>
          <p className="lb-sub">arquitetura e interiores</p>
          <p className="lb-statement">
            Cada projeto,
            <br />
            uma história conduzida
            <br />
            <em>com cuidado.</em>
          </p>
          <p className="lb-foot">© {new Date().getFullYear()}</p>
        </div>
      </aside>
      <div className="login-panel">
      <div className="login-card">
        <h1 className="login-title">{recuperando ? 'Recuperar senha' : 'Portal do cliente'}</h1>
        <p className="login-sub">
          {recuperando
            ? 'Enviamos um link para você criar uma senha nova.'
            : 'Acompanhe cada etapa do seu projeto.'}
        </p>
        {recuperando ? (
          enviado ? (
            <div className="recuperar-ok" role="status">
              <p>
                Se <strong>{email.trim()}</strong> estiver cadastrado, o link chega em alguns
                minutos. Confira também a caixa de spam.
              </p>
              <button type="button" className="btn btn-ghost btn-block" onClick={voltarAoLogin}>
                Voltar para o login
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviarLink();
              }}
            >
              <label className="field">
                <Mail size={15} />
                <input
                  type="email"
                  placeholder="Seu e-mail"
                  aria-label="E-mail cadastrado"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              {err && <p className="error">{err}</p>}
              <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
                {busy ? 'Enviando…' : 'Enviar link'}
              </button>
              <button type="button" className="forgot" onClick={voltarAoLogin}>
                Voltar para o login
              </button>
            </form>
          )
        ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
        <label className="field">
          <Mail size={15} />
          <input
            type="email"
            placeholder="Seu e-mail"
            aria-label="E-mail"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {fieldErr.email && <p className="error">{fieldErr.email}</p>}
        <label className="field">
          <Lock size={15} />
          <input
            type="password"
            placeholder="Senha"
            aria-label="Senha"
            autoComplete="current-password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
        </label>
        {fieldErr.pass && <p className="error">{fieldErr.pass}</p>}
        {err && <p className="error">{err}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        </form>
        )}

        {IS_SUPABASE && !recuperando && (
          <button
            type="button"
            className="forgot"
            onClick={() => {
              setRecuperando(true);
              setErr('');
              setFieldErr({});
            }}
          >
            Esqueci minha senha
          </button>
        )}
        {!IS_SUPABASE && (
          <div className="demo">
            <span>Acessos de teste</span>
            <button
              onClick={() => {
                setEmail('studio@demo.com');
                setPass('1234');
              }}
            >
              Studio — Gabriela
            </button>
            <button
              onClick={() => {
                setEmail('cliente@demo.com');
                setPass('1234');
              }}
            >
              Cliente — Vanessa
            </button>
            <button
              onClick={() => {
                setEmail('cliente2@demo.com');
                setPass('1234');
              }}
            >
              Cliente — Marcos
            </button>
          </div>
        )}
      </div>
      <p className="login-foot">
        © {new Date().getFullYear()} {STUDIO.name}
      </p>
      </div>
    </div>
  );
}
