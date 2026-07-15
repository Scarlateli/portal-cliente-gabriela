// Edge Function: autentique-send (verify_jwt = true)
// Envia o PDF de um contrato/termo para assinatura na Autentique (API v2,
// GraphQL multipart). Só o studio pode chamar. O signatário é o CLIENTE do
// projeto — a Autentique envia o e-mail de assinatura para ele.
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
    const token = Deno.env.get('AUTENTIQUE_TOKEN');
    if (!token) return json({ error: 'AUTENTIQUE_TOKEN não configurado nos secrets' }, 500);

    const authed = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    });
    const { data: userData } = await authed.auth.getUser();
    if (!userData?.user) return json({ error: 'não autenticado' }, 401);
    const { data: me } = await authed
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single();
    if (!me || me.role !== 'studio') return json({ error: 'apenas o studio' }, 403);

    const { contractId } = await req.json();
    if (!contractId) return json({ error: 'contractId obrigatório' }, 400);

    const admin = createClient(url, service);
    const { data: c, error: cErr } = await admin
      .from('contracts')
      .select('id, name, storage_path, sig_status, project_id')
      .eq('id', contractId)
      .single();
    if (cErr || !c) return json({ error: 'contrato não encontrado' }, 404);
    if (!c.storage_path) return json({ error: 'anexe o PDF do contrato antes de enviar' }, 400);
    if (c.sig_status === 'assinado') return json({ error: 'este documento já está assinado' }, 400);

    const { data: proj } = await admin
      .from('projects')
      .select('client_id')
      .eq('id', c.project_id)
      .single();
    const { data: prof } = await admin
      .from('profiles')
      .select('email, name')
      .eq('id', proj!.client_id)
      .single();
    if (!prof?.email) return json({ error: 'cliente do projeto sem e-mail' }, 400);

    const dl = await admin.storage.from('documentos').download(c.storage_path);
    if (dl.error || !dl.data) return json({ error: 'não consegui ler o PDF no Storage' }, 500);

    const ops = JSON.stringify({
      query:
        'mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) { createDocument(document: $document, signers: $signers, file: $file) { id name } }',
      variables: {
        document: { name: c.name },
        signers: [{ email: prof.email, action: 'SIGN' }],
        file: null,
      },
    });
    const fd = new FormData();
    fd.append('operations', ops);
    fd.append('map', JSON.stringify({ file: ['variables.file'] }));
    fd.append('file', dl.data, c.name.replace(/[^\w.\- ]+/g, '') + '.pdf');

    const r = await fetch('https://api.autentique.com.br/v2/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const out = await r.json().catch(() => null);
    const doc = out?.data?.createDocument;
    if (!r.ok || !doc?.id) {
      const msg = out?.errors?.[0]?.message || `Autentique HTTP ${r.status}`;
      return json({ error: 'Autentique recusou: ' + String(msg).slice(0, 300) }, 502);
    }

    const { error: upErr } = await admin
      .from('contracts')
      .update({
        sig_status: 'enviado',
        provider: 'Autentique',
        provider_doc_id: String(doc.id),
        signer: prof.email,
      })
      .eq('id', c.id);
    if (upErr) return json({ error: upErr.message }, 500);

    return json({ ok: true, providerDocId: doc.id, signerEmail: prof.email });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
