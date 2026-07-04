// Edge Function: invite-client
// 1) valida que quem chama é usuário do studio;
// 2) gera o LINK de acesso do cliente (generateLink type "invite"; se o
//    e-mail já existir, gera type "recovery" — mesmo efeito: definir senha).
//    Sem SMTP: o studio copia o link e envia por WhatsApp/e-mail;
// 3) garante a linha em profiles (role client) via service_role;
// 4) devolve { userId, actionLink }.
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
    if (!me || me.role !== 'studio') return json({ error: 'apenas o studio pode convidar clientes' }, 403);

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
      const rec = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo } });
      if (rec.error) return json({ error: rec.error.message }, 400);
      userId = rec.data.user?.id ?? null;
      actionLink = rec.data.properties?.action_link ?? null;
    }
    if (!userId) return json({ error: 'não foi possível criar o acesso do cliente' }, 500);

    // cria o profile só se ainda não existir (nunca rebaixa um studio)
    const { data: existing } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (!existing) {
      const { error: pErr } = await admin
        .from('profiles')
        .insert({ id: userId, role: 'client', name: name || email });
      if (pErr) return json({ error: pErr.message }, 500);
    }

    return json({ userId, actionLink });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
