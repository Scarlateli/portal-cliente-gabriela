import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Mark } from './atoms.jsx';
import { getSupabase } from '../lib/supabase/client.js';

/* Primeiro acesso do cliente: o link de convite abre o app já autenticado
   (token no hash) e esta tela define a senha via supabase.auth.updateUser. */
export function SetPassword({ onDone }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (p1.length < 8) {
      setErr('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (p1 !== p2) {
      setErr('As senhas não conferem.');
      return;
    }
    setErr('');
    setBusy(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({ password: p1 });
      if (error) throw error;
      onDone();
    } catch {
      setErr('Não foi possível salvar a senha. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <Mark />
        <h1 className="login-title">Crie sua senha</h1>
        <p className="login-sub">Defina a senha que você usará para acessar o portal.</p>
        <label className="field">
          <Lock size={15} />
          <input
            type="password"
            placeholder="Nova senha"
            value={p1}
            onChange={(e) => setP1(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </label>
        <label className="field">
          <Lock size={15} />
          <input
            type="password"
            placeholder="Confirmar a senha"
            value={p2}
            onChange={(e) => setP2(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </label>
        {err && <p className="error">{err}</p>}
        <button className="btn btn-primary btn-block" onClick={submit} disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar e entrar'}
        </button>
      </div>
    </div>
  );
}
