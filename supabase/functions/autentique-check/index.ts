// Edge Function: autentique-check (verify_jwt = true)
// Consulta o status REAL de um documento na Autentique (pull) e, se estiver
// assinado, marca o contrato — independência do webhook deles (que se
// mostrou silencioso). Autorização elegante: o contrato é lido com o JWT de
// quem chamou; se a RLS deixa ver, a pessoa pode verificar.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const token = Deno.env.get('AUTENTIQUE_TOKEN');
    if (!token) return json({ error: 'AUTENTIQUE_TOKEN ausente' }, 500);
    const { contractId } = await req.json();
    if (!contractId) return json({ error: 'contractId obrigatório' }, 400);

    const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    });
    const { data: c } = await caller
      .from('contracts')
      .select('id, sig_status, provider_doc_id')
      .eq('id', contractId)
      .maybeSingle();
    if (!c) return json({ error: 'contrato não encontrado' }, 404);
    if (c.sig_status === 'assinado') return json({ status: 'assinado' });
    if (!c.provider_doc_id) return json({ status: c.sig_status });

    const r = await fetch('https://api.autentique.com.br/v2/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query:
          'query($id: UUID!) { document(id: $id) { id signatures { email signed { created_at } rejected { created_at } } } }',
        variables: { id: c.provider_doc_id },
      }),
    });
    const out = await r.json().catch(() => null);
    const sigs = out?.data?.document?.signatures;
    if (!Array.isArray(sigs) || sigs.length === 0) {
      const msg = out?.errors?.[0]?.message || `Autentique HTTP ${r.status}`;
      return json({ status: c.sig_status, note: String(msg).slice(0, 200) });
    }
    const allSigned = sigs.every((s: { signed?: { created_at?: string } | null }) => s?.signed?.created_at);
    if (!allSigned) return json({ status: 'enviado' });

    const when = sigs[0]?.signed?.created_at;
    const dia = when
      ? new Date(new Date(when).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10)
      : new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await admin.from('contracts').update({ sig_status: 'assinado', signed_at: dia }).eq('id', c.id);
    return json({ status: 'assinado', signedAt: dia });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
