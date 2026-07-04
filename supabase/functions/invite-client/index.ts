// Edge Function: invite-client
// 1) valida que quem chama é usuário do studio;
// 2) gera o LINK de acesso do cliente (generateLink "invite"; "recovery" se o
//    e-mail já existir — mesmo efeito: definir senha);
// 3) garante a linha em profiles (role client) via service_role;
// 4) se o secret RESEND_API_KEY existir, envia o convite por E-MAIL (Resend);
// 5) devolve { userId, actionLink, emailSent }.
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

function inviteHtml(name: string | undefined, actionLink: string) {
  const hello = name ? `Olá, ${name}!` : 'Olá!';
  return `<!doctype html><html><body style="margin:0;background:#d8d4ca;padding:32px 16px;font-family:Futura,'Century Gothic',Arial,sans-serif;color:#210909">
  <div style="max-width:480px;margin:0 auto;background:#efece5;border:1px solid #cfc8b8;border-radius:6px;padding:32px">
    <p style="margin:0;font-size:15px;letter-spacing:.14em;text-transform:uppercase;text-align:center">Gabriela Lendecker</p>
    <p style="margin:4px 0 24px;font-size:11px;letter-spacing:.3em;color:#7a6f60;text-align:center">arquitetura e interiores</p>
    <p style="font-size:14px;line-height:1.6">${hello} Seu Portal do Cliente está pronto. Nele você acompanha cada etapa do projeto, documentos, contratos e pagamentos.</p>
    <p style="text-align:center;margin:28px 0"><a href="${actionLink}" style="background:#5d1c17;color:#efece5;text-decoration:none;padding:12px 26px;border-radius:5px;font-size:14px;display:inline-block">Criar minha senha e entrar</a></p>
    <p style="font-size:12px;color:#7a6f60;line-height:1.5;word-break:break-all">Se o botão não funcionar, copie e cole este endereço no navegador:<br>${actionLink}</p>
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

    const { email, name } = await req.json();
    if (!email) return json({ error: 'e-mail obrigatório' }, 400);

    const admin = createClient(url, service);
    const redirectTo = req.headers.get('origin') || undefined;

    let userId: string | null = null;
    let actionLink: string | null = null;
    const inv = await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { data: { name }, redirectTo },
    });
    if (!inv.error) {
      userId = inv.data.user?.id ?? null;
      actionLink = inv.data.properties?.action_link ?? null;
    } else {
      const rec = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo },
      });
      if (rec.error) return json({ error: rec.error.message }, 400);
      userId = rec.data.user?.id ?? null;
      actionLink = rec.data.properties?.action_link ?? null;
    }
    if (!userId) return json({ error: 'não foi possível criar o acesso do cliente' }, 500);

    // cria o profile só se ainda não existir (nunca rebaixa um studio)
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (!existing) {
      const { error: pErr } = await admin
        .from('profiles')
        .insert({ id: userId, role: 'client', name: name || email });
      if (pErr) return json({ error: pErr.message }, 500);
    }

    // envio opcional por e-mail (Resend) — o link continua sendo devolvido
    let emailSent = false;
    let emailError: string | null = null;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey && actionLink) {
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
            html: inviteHtml(name, actionLink),
          }),
        });
        if (r.ok) emailSent = true;
        else emailError = `Resend ${r.status}: ${(await r.text()).slice(0, 300)}`;
      } catch (err) {
        emailError = String((err as Error)?.message || err);
      }
    }

    return json({ userId, actionLink, emailSent, emailError });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
