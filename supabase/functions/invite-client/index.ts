// Edge Function: invite-client (v5 — senha provisória)
// 1) valida que quem chama é usuário do studio;
// 2) cria o usuário do cliente com uma SENHA PROVISÓRIA gerada aqui; se o
//    e-mail já existir, redefine a provisória do usuário existente. Marca
//    must_change_password — o app força a troca no 1º login;
// 3) recusa o e-mail do próprio studio (proteção contra reset acidental);
// 4) garante a linha em profiles (role client) via service_role;
// 5) se o secret RESEND_API_KEY existir, envia e-mail com as credenciais;
// 6) devolve { userId, tempPassword, emailSent }.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function tempPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // sem caracteres ambíguos
  let s = '';
  for (let i = 0; i < 9; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return 'gl-' + s;
}

function inviteHtml(name: string | undefined, appUrl: string, email: string, temp: string) {
  const hello = name ? `Olá, ${name}!` : 'Olá!';
  const btn = appUrl
    ? `<p style="text-align:center;margin:26px 0 20px"><a href="${appUrl}" style="background:#5d1c17;color:#efece5;text-decoration:none;padding:12px 26px;border-radius:5px;font-size:14px;display:inline-block">Acessar o portal</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#d8d4ca;padding:32px 16px;font-family:Futura,'Century Gothic',Arial,sans-serif;color:#210909">
  <div style="max-width:480px;margin:0 auto;background:#efece5;border:1px solid #cfc8b8;border-radius:6px;padding:32px">
    <p style="margin:0;font-size:15px;letter-spacing:.14em;text-transform:uppercase;text-align:center">Gabriela Lendecker</p>
    <p style="margin:4px 0 24px;font-size:11px;letter-spacing:.3em;color:#7a6f60;text-align:center">arquitetura e interiores</p>
    <p style="font-size:14px;line-height:1.6">${hello} Seu Portal do Cliente está pronto. Nele você acompanha cada etapa do projeto, documentos, contratos e pagamentos.</p>
    ${btn}
    <div style="background:#d8d4ca;border-radius:5px;padding:14px 16px;font-size:13px;line-height:1.8">
      <strong>e-mail:</strong> ${email}<br>
      <strong>senha provisória:</strong> ${temp}
    </div>
    <p style="font-size:12px;color:#7a6f60;line-height:1.5;margin-top:14px">No primeiro acesso, você criará a sua senha definitiva.</p>
  </div>
  <p style="text-align:center;font-size:11px;color:#7a6f60;margin-top:16px">© ${new Date().getFullYear()} Gabriela Lendecker</p>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authed = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    });
    const { data: userData } = await authed.auth.getUser();
    const caller = userData?.user;
    if (!caller) return json({ error: 'não autenticado' }, 401);
    const { data: me } = await authed.from('profiles').select('role').eq('id', caller.id).single();
    if (!me || me.role !== 'studio')
      return json({ error: 'apenas o studio pode convidar clientes' }, 403);

    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const name = body.name;
    if (!email) return json({ error: 'e-mail obrigatório' }, 400);

    const admin = createClient(url, service);

    // proteção: nunca mexer na conta do próprio studio
    const { data: taken } = await admin
      .from('profiles')
      .select('role')
      .eq('email', email)
      .maybeSingle();
    if (taken && taken.role === 'studio')
      return json({ error: 'esse e-mail pertence ao studio — use o e-mail do cliente' }, 400);

    const appUrl = req.headers.get('origin') || '';
    const temp = tempPassword();
    let userId: string | null = null;

    const created = await admin.auth.admin.createUser({
      email,
      password: temp,
      email_confirm: true,
      user_metadata: { name, must_change_password: true },
    });
    if (!created.error) {
      userId = created.data.user?.id ?? null;
    } else {
      // e-mail já cadastrado: localiza o usuário e redefine a senha provisória
      const rec = await admin.auth.admin.generateLink({ type: 'recovery', email });
      if (rec.error) return json({ error: rec.error.message }, 400);
      userId = rec.data.user?.id ?? null;
      if (!userId) return json({ error: 'usuário existente não encontrado' }, 500);
      const upd = await admin.auth.admin.updateUserById(userId, {
        password: temp,
        email_confirm: true,
        user_metadata: { name, must_change_password: true },
      });
      if (upd.error) return json({ error: upd.error.message }, 500);
    }
    if (!userId) return json({ error: 'não foi possível criar o acesso do cliente' }, 500);

    // cria o profile só se ainda não existir
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (!existing) {
      const { error: pErr } = await admin
        .from('profiles')
        .insert({ id: userId, role: 'client', name: name || email, email });
      if (pErr) return json({ error: pErr.message }, 500);
    }

    // envio opcional por e-mail (Resend) — a senha continua sendo devolvida
    let emailSent = false;
    let emailError: string | null = null;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey) {
      try {
        const from =
          Deno.env.get('INVITE_FROM') || 'Portal Gabriela Lendecker <onboarding@resend.dev>';
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from,
            to: [email],
            subject: 'Seu acesso ao Portal do Cliente — Gabriela Lendecker',
            html: inviteHtml(name, appUrl, email, temp),
          }),
        });
        if (r.ok) emailSent = true;
        else emailError = `Resend ${r.status}: ${(await r.text()).slice(0, 300)}`;
      } catch (err) {
        emailError = String((err as Error)?.message || err);
      }
    }

    return json({ userId, tempPassword: temp, emailSent, emailError });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
