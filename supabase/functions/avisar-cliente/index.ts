// Edge Function: avisar-cliente (rodada 4)
// O studio pediu algo ao cliente no portal (confirmar uma ata, aprovar uma
// etapa, enviar arquivos…) e quer que ele saiba na hora: manda um e-mail
// curto dizendo o que está esperando por ele, com o botão para entrar.
// 1) só o studio chama;
// 2) busca o cliente do projeto (e-mail, nome) e o vocativo do projeto;
// 3) envia pelo Resend (se RESEND_API_KEY existir);
// 4) devolve { emailSent, emailError }.
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

const esc = (t: string) =>
  String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function avisoHtml(hello: string, projeto: string, texto: string, appUrl: string) {
  const btn = appUrl
    ? `<p style="text-align:center;margin:26px 0 8px"><a href="${esc(appUrl)}" style="background:#391312;color:#EFECE6;text-decoration:none;padding:12px 26px;border-radius:5px;font-size:14px;display:inline-block">Abrir o portal</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#D9D4C9;padding:32px 16px;font-family:'Futura Std',Futura,'Century Gothic',Arial,sans-serif;color:#210B0B">
  <div style="max-width:480px;margin:0 auto;background:#EFECE6;border:1px solid #CBC4B6;border-radius:6px;padding:34px 32px">
    <img src="https://portal.gabrielalendecker.com/brand/lockup-email.png" width="280" alt="Gabriela Lendecker — arquitetura e interiores" style="display:block;margin:0 auto 28px;width:280px;max-width:100%;height:auto;border:0">
    <p style="font-size:14px;line-height:1.6">Olá, ${esc(hello)}! Há um item esperando você no Portal do Projeto <strong>${esc(projeto)}</strong>:</p>
    <div style="background:#D9D4C9;border-radius:5px;padding:14px 16px;font-size:14px;line-height:1.6">${esc(texto)}</div>
    ${btn}
    <p style="font-size:12px;color:#70463A;line-height:1.5;margin-top:14px">Ao entrar, o item aparece no sino do topo da tela.</p>
  </div>
  <p style="text-align:center;font-size:11px;color:#70463A;margin-top:16px">© ${new Date().getFullYear()} Gabriela Lendecker</p>
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
    if (!me || me.role !== 'studio') return json({ error: 'apenas o studio pode avisar clientes' }, 403);

    const body = await req.json();
    const projectId = String(body.projectId || '');
    const texto = String(body.texto || '').trim().slice(0, 300);
    if (!projectId || !texto) return json({ error: 'projeto e texto são obrigatórios' }, 400);

    const admin = createClient(url, service);
    const { data: proj } = await admin
      .from('projects')
      .select('name, greeting, client_id')
      .eq('id', projectId)
      .maybeSingle();
    if (!proj) return json({ error: 'projeto não encontrado' }, 404);
    const { data: cli } = await admin.from('profiles').select('name, email').eq('id', proj.client_id).maybeSingle();
    if (!cli || !cli.email) return json({ error: 'cliente sem e-mail cadastrado' }, 400);

    const hello = String(proj.greeting || '').trim() || String(cli.name || '').trim().split(/\s+/)[0] || '';
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) return json({ emailSent: false, emailError: 'e-mail não configurado' });
    const from = Deno.env.get('INVITE_FROM') || 'Portal Gabriela Lendecker <onboarding@resend.dev>';
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [cli.email],
        subject: 'Um item espera você no Portal do Projeto — ' + proj.name,
        html: avisoHtml(hello, proj.name, texto, req.headers.get('origin') || ''),
      }),
    });
    if (!r.ok) return json({ emailSent: false, emailError: `Resend ${r.status}: ${(await r.text()).slice(0, 300)}` });
    return json({ emailSent: true, emailError: null });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
