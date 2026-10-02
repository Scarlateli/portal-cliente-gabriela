// Edge Function: forgot-password (pública, verify_jwt = false)
// Recebe { email } e, SE o usuário existir, envia por e-mail (Resend) um link
// de redefinição de senha (generateLink type=recovery — a tela "Crie sua
// senha" do app já atende esse link). A resposta é SEMPRE { ok: true } para
// não revelar se um e-mail está ou não cadastrado.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const ok = () =>
  new Response(JSON.stringify({ ok: true }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { email } = await req.json();
    const clean = String(email || '').trim().toLowerCase();
    if (!clean) return ok();

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const redirectTo = req.headers.get('origin') || undefined;
    const rec = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: clean,
      options: { redirectTo },
    });
    const link = rec.data?.properties?.action_link;
    const key = Deno.env.get('RESEND_API_KEY');
    if (!rec.error && link && key) {
      const from =
        Deno.env.get('INVITE_FROM') || 'Portal Gabriela Lendecker <onboarding@resend.dev>';
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [clean],
          subject: 'Redefinição de senha — Portal do Projeto Gabriela Lendecker',
          html: `<!doctype html><html><body style="margin:0;background:#D9D4C9;padding:32px 16px;font-family:'Futura Std',Futura,'Century Gothic',Arial,sans-serif;color:#210B0B">
  <div style="max-width:480px;margin:0 auto;background:#EFECE6;border:1px solid #CBC4B6;border-radius:6px;padding:34px 32px">
    <img src="https://portal.gabrielalendecker.com/brand/lockup-email.png" width="280" alt="Gabriela Lendecker — arquitetura e interiores" style="display:block;margin:0 auto 28px;width:280px;max-width:100%;height:auto;border:0">
    <p style="font-size:14px;line-height:1.6">Recebemos um pedido para redefinir a sua senha do Portal do Projeto. Se foi você, clique abaixo:</p>
    <p style="text-align:center;margin:26px 0"><a href="${link}" style="background:#391312;color:#EFECE6;text-decoration:none;padding:12px 26px;border-radius:5px;font-size:14px;display:inline-block">Redefinir minha senha</a></p>
    <p style="font-size:12px;color:#70463A;line-height:1.5">Se você não pediu isso, pode ignorar este e-mail — nada muda.</p>
  </div>
</body></html>`,
        }),
      }).catch(() => {});
    }
    return ok();
  } catch {
    return ok();
  }
});
