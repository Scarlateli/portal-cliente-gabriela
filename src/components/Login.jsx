import { useState } from 'react';
import { Mail, Lock } from 'lucide-react';
import { Mark } from './atoms.jsx';
import { STUDIO } from '../lib/constants.js';
import { loginSchema, validate } from '../lib/validation.js';
import { IS_SUPABASE } from '../lib/data.js';

export function Login({ db, onLogin }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [fieldErr, setFieldErr] = useState({});
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="login">
      <div className="login-card">
        <Mark />
        <h1 className="login-title">Portal do cliente</h1>
        <p className="login-sub">Acompanhe cada etapa do seu projeto.</p>
        <label className="field">
          <Mail size={15} />
          <input
            type="email"
            placeholder="Seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </label>
        {fieldErr.email && <p className="error">{fieldErr.email}</p>}
        <label className="field">
          <Lock size={15} />
          <input
            type="password"
            placeholder="Senha"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </label>
        {fieldErr.pass && <p className="error">{fieldErr.pass}</p>}
        {err && <p className="error">{err}</p>}
        <button className="btn btn-primary btn-block" onClick={submit} disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
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
  );
}
