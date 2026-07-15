// Edge Function: autentique-webhook (verify_jwt = false — a Autentique chama)
// Recebe eventos da Autentique e, quando o documento é assinado/finalizado,
// marca o contrato correspondente (provider_doc_id) como "assinado".
// Parser tolerante: formatos de payload variam; logamos o corpo p/ ajuste.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ok = () => new Response(JSON.stringify({ ok: true }), {
  headers: { 'Content-Type': 'application/json' },
});

function findDocId(b: unknown): string | null {
  const x = b as Record<string, any>;
  const cands = [
    x?.document?.id, x?.documento?.id, x?.data?.document?.id,
    x?.data?.documento?.id, x?.data?.id, x?.id,
  ];
  for (const c of cands) if (c) return String(c);
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return ok();
  try {
    const body = await req.json().catch(() => null);
    if (!body) return ok();
    const raw = JSON.stringify(body).toLowerCase();
    console.log('autentique-webhook:', raw.slice(0, 800));
    const docId = findDocId(body);
    const looksSigned =
      raw.includes('assin') || raw.includes('finish') || raw.includes('finaliz') ||
      (raw.includes('sign') && (raw.includes('accept') || raw.includes('complete')));
    if (docId && looksSigned) {
      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
      await admin
        .from('contracts')
        .update({ sig_status: 'assinado', signed_at: hoje })
        .eq('provider', 'Autentique')
        .eq('provider_doc_id', docId);
    }
    return ok();
  } catch {
    return ok();
  }
});
