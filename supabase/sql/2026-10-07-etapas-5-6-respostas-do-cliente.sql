-- Etapas 5 e 6 — o cliente responde a documentos, termos e contratos.
-- Parte ADITIVA: colunas e funções novas. O código anterior do portal
-- continua funcionando com isto aplicado.
-- Aplicada no projeto em 07/10/2026 (migração etapas5_6_respostas_do_cliente).

-- ============================================================
-- Etapa 5 — documentos: a Gabriela escolhe se pede assinatura, só um OK,
-- ou nada. O pedido fica pendente para o cliente até ele responder.
-- ============================================================
alter table public.documents
  add column if not exists approval text not null default 'nenhuma',
  add column if not exists response text,
  add column if not exists responded_at timestamptz,
  add column if not exists responded_name text;

do $$ begin
  alter table public.documents add constraint documents_approval_check
    check (approval in ('nenhuma', 'ok', 'assinatura'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.documents add constraint documents_response_check
    check (response is null or response in ('aprovado', 'assinado'));
exception when duplicate_object then null; end $$;

-- ============================================================
-- Etapa 6 — termos e contratos.
--   method = 'aceite'     → termo: o cliente aprova ou recusa com um botão
--   method = 'portal'     → o cliente assina dentro do portal (nome digitado)
--   method = 'autentique' → assinatura com validade jurídica na Autentique
-- body: texto do termo escrito no próprio portal (PDF passa a ser opcional).
-- ============================================================
alter table public.contracts
  add column if not exists method text not null default 'autentique',
  add column if not exists body text,
  add column if not exists response_note text,
  add column if not exists responded_at timestamptz;

do $$ begin
  alter table public.contracts add constraint contracts_method_check
    check (method in ('autentique', 'portal', 'aceite'));
exception when duplicate_object then null; end $$;

alter table public.contracts drop constraint if exists contracts_sig_status_check;
alter table public.contracts add constraint contracts_sig_status_check
  check (sig_status in ('rascunho', 'enviado', 'assinado', 'recusado'));

-- termos existentes passam ao fluxo de aprovar/recusar; contratos seguem na Autentique
update public.contracts set method = 'aceite' where kind = 'termo' and method = 'autentique';

-- ============================================================
-- Funções pelas quais o CLIENTE age. Cada uma confere que o registro é de
-- um projeto dele (owns_project, que também respeita o acesso expirado) e
-- altera só os campos daquela ação. Assim o cliente não precisa de
-- permissão geral de edição nas tabelas.
-- ============================================================
create or replace function public.responder_documento(p_documento uuid, p_nome text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare d record;
begin
  select id, project_id, approval, response into d
    from public.documents where id = p_documento for update;
  if d.id is null or not public.owns_project(d.project_id) then
    raise exception 'Documento não encontrado.' using errcode = '42501';
  end if;
  if d.approval = 'nenhuma' then
    raise exception 'Este documento não pede resposta.';
  end if;
  if d.response is not null then
    raise exception 'Este documento já foi respondido.';
  end if;
  if d.approval = 'assinatura' then
    if coalesce(length(trim(p_nome)), 0) < 3 then
      raise exception 'Digite o seu nome completo para assinar.';
    end if;
    update public.documents
      set response = 'assinado', responded_at = now(), responded_name = trim(p_nome)
      where id = p_documento;
  else
    update public.documents
      set response = 'aprovado', responded_at = now(),
          responded_name = (select name from public.profiles where id = (select auth.uid()))
      where id = p_documento;
  end if;
end $$;

create or replace function public.responder_contrato(
  p_contrato uuid, p_acao text, p_nome text default null, p_motivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare c record; nome_cliente text;
begin
  select id, project_id, method, sig_status into c
    from public.contracts where id = p_contrato for update;
  if c.id is null or not public.owns_project(c.project_id) then
    raise exception 'Documento não encontrado.' using errcode = '42501';
  end if;
  if c.sig_status <> 'enviado' then
    raise exception 'Este documento não está aguardando a sua resposta.';
  end if;
  select name into nome_cliente from public.profiles where id = (select auth.uid());

  if p_acao = 'aprovar' and c.method = 'aceite' then
    update public.contracts
      set sig_status = 'assinado', signer = nome_cliente, signed_at = current_date,
          provider = 'Portal', responded_at = now(), response_note = null
      where id = p_contrato;
  elsif p_acao = 'recusar' and c.method = 'aceite' then
    update public.contracts
      set sig_status = 'recusado', responded_at = now(),
          response_note = nullif(trim(coalesce(p_motivo, '')), '')
      where id = p_contrato;
  elsif p_acao = 'assinar' and c.method = 'portal' then
    if coalesce(length(trim(p_nome)), 0) < 3 then
      raise exception 'Digite o seu nome completo para assinar.';
    end if;
    update public.contracts
      set sig_status = 'assinado', signer = trim(p_nome), signed_at = current_date,
          provider = 'Portal', responded_at = now(), response_note = null
      where id = p_contrato;
  else
    raise exception 'Ação não permitida para este documento.';
  end if;
end $$;

revoke all on function public.responder_documento(uuid, text) from public, anon;
revoke all on function public.responder_contrato(uuid, text, text, text) from public, anon;
grant execute on function public.responder_documento(uuid, text) to authenticated;
grant execute on function public.responder_contrato(uuid, text, text, text) to authenticated;
