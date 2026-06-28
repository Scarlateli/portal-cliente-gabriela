// supabase/functions/invite-client/index.ts
//
// Cria o login de um cliente sem expor a service_role no front-end.
// Chamada por db-supabase.addProject via supabase.functions.invoke('invite-client').
//
// Fluxo:
//   1. valida que quem chama é um usuário do studio (pela RLS de profiles);
//   2. envia um convite por e-mail (inviteUserByEmail) — o cliente define a
//      própria senha no primeiro acesso;
//   3. cria a linha em "profiles" (role: 'client') usando a service_role;
//   4. devolve { userId } para o front inserir projeto + contrato.
//
// Deploy:
//   supabase functions deploy invite-client
// Segredos necessários (já existem por padrão em projetos Supabase):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//
// Observação: defina o "Site URL"/redirect em Authentication > URL Configuration
// para que o link do convite aponte para o app.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    // Cliente "como o chamador" — respeita RLS, identifica quem está logado.
    const asCaller = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
    } = await asCaller.auth.getUser();
    if (!caller) return json({ error: 'Não autenticado.' }, 401);

    const { data: callerProfile } = await asCaller
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();
    if (!callerProfile || callerProfile.role !== 'studio')
      return json({ error: 'Apenas o studio pode cadastrar clientes.' }, 403);

    const { email, name } = await req.json();
    if (!email || !name) return json({ error: 'Informe e-mail e nome do cliente.' }, 400);
    const cleanEmail = String(email).trim().toLowerCase();

    // Cliente admin (service_role) — só no servidor.
    const admin = createClient(url, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) convite por e-mail (cria o auth.user sem senha).
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      cleanEmail,
      { data: { name, role: 'client' } },
    );
    if (inviteErr || !invited?.user) {
      return json({ error: inviteErr?.message || 'Falha ao convidar o cliente.' }, 400);
    }
    const userId = invited.user.id;

    // 2) profile correspondente.
    const { error: profErr } = await admin
      .from('profiles')
      .insert({ id: userId, role: 'client', name, email: cleanEmail });
    if (profErr) {
      // rollback do auth.user para não deixar órfão
      await admin.auth.admin.deleteUser(userId);
      return json({ error: profErr.message }, 400);
    }

    return json({ userId });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erro inesperado.' }, 500);
  }
});
