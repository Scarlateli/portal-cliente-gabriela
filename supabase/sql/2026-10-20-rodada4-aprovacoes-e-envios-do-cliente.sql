-- Rodada 4 (revisão da Gabriela em 19–20/10/2026).
-- Só acréscimos: o código anterior do
-- portal continua funcionando antes e depois desta mudança, então ela entra
-- ANTES de publicar o código novo. Aplicada no projeto em 20/10/2026, em três
-- partes (rodada4a_documentos_ajustes, rodada4b_aprovacao_de_etapa,
-- rodada4c_envios_do_cliente).

-- ---------------------------------------------------------------------
-- 1) Documentos: o cliente também pode "pedir ajustes" (com a mensagem),
--    além de confirmar ou assinar.
-- ---------------------------------------------------------------------
alter table public.documents add column if not exists response_note text;
alter table public.documents drop constraint if exists documents_response_check;
alter table public.documents add constraint documents_response_check
  check (response is null or response in ('aprovado', 'assinado', 'ajustes'));

-- Função nova para a resposta do cliente (confirmar, assinar ou pedir
-- ajustes). A antiga, responder_documento(uuid, text), fica no banco para o
-- código anterior continuar funcionando até o deploy; não é apagada aqui
-- porque o Supabase pede confirmação manual para apagar e cancela a
-- migração quando ninguém confirma (foi o que travou a Etapa 8 e a 1ª
-- tentativa desta). Pode ser apagada depois, à mão.
create or replace function public.confirmar_documento(
  p_documento uuid, p_decisao text default 'confirmar',
  p_nome text default null, p_mensagem text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare d record; msg text := nullif(trim(coalesce(p_mensagem, '')), '');
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
  if p_decisao = 'ajustes' then
    if msg is null then
      raise exception 'Conte o que precisa ser ajustado.';
    end if;
    update public.documents
      set response = 'ajustes', response_note = left(msg, 2000), responded_at = now(),
          responded_name = (select name from public.profiles where id = (select auth.uid()))
      where id = p_documento;
  elsif p_decisao <> 'confirmar' then
    raise exception 'Resposta inválida.';
  elsif d.approval = 'assinatura' then
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
revoke all on function public.confirmar_documento(uuid, text, text, text) from public, anon;
grant execute on function public.confirmar_documento(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2) Etapas: o studio pede a aprovação do cliente ao fim de uma etapa;
--    o cliente aprova (nome completo) ou pede ajustes (mensagem), pelo
--    portal, sem contrato.
-- ---------------------------------------------------------------------
alter table public.stages
  add column if not exists approval text not null default 'nenhuma',
  add column if not exists approval_requested_at timestamptz,
  add column if not exists approval_at timestamptz,
  add column if not exists approval_name text,
  add column if not exists approval_note text;
alter table public.stages drop constraint if exists stages_approval_check;
alter table public.stages add constraint stages_approval_check
  check (approval in ('nenhuma', 'pendente', 'aprovada', 'ajustes'));

create or replace function public.responder_etapa(
  p_etapa uuid, p_decisao text, p_nome text default null, p_mensagem text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s record; msg text := nullif(trim(coalesce(p_mensagem, '')), '');
begin
  select id, project_id, approval into s from public.stages where id = p_etapa for update;
  if s.id is null or not public.owns_project(s.project_id) then
    raise exception 'Etapa não encontrada.' using errcode = '42501';
  end if;
  if s.approval <> 'pendente' then
    raise exception 'Esta etapa não está aguardando a sua aprovação.';
  end if;
  if p_decisao = 'aprovar' then
    if coalesce(length(trim(p_nome)), 0) < 3 then
      raise exception 'Digite o seu nome completo para aprovar.';
    end if;
    update public.stages
      set approval = 'aprovada', approval_at = now(), approval_name = trim(p_nome), approval_note = msg
      where id = p_etapa;
  elsif p_decisao = 'ajustes' then
    if msg is null then
      raise exception 'Conte o que precisa ser ajustado.';
    end if;
    update public.stages
      set approval = 'ajustes', approval_at = now(), approval_note = left(msg, 2000),
          approval_name = (select name from public.profiles where id = (select auth.uid()))
      where id = p_etapa;
  else
    raise exception 'Decisão inválida.';
  end if;
end $$;
revoke all on function public.responder_etapa(uuid, text, text, text) from public, anon;
grant execute on function public.responder_etapa(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3) Envios do cliente: uma sub-etapa pode pedir arquivos ao cliente, com
--    instruções; o cliente manda quantos arquivos precisar e deixa uma nota.
-- ---------------------------------------------------------------------
alter table public.stage_subs
  add column if not exists pede_arquivos boolean not null default false,
  add column if not exists instructions text,
  add column if not exists client_note text;

create table if not exists public.sub_arquivos (
  id uuid primary key default gen_random_uuid(),
  sub_id uuid not null references public.stage_subs (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  storage_path text not null,
  size text,
  sent_by text not null check (sent_by in ('studio', 'client')),
  created_at timestamptz not null default now()
);
create index if not exists idx_sub_arquivos_sub on public.sub_arquivos (sub_id);
create index if not exists idx_sub_arquivos_project on public.sub_arquivos (project_id);
alter table public.sub_arquivos enable row level security;

-- leitura: studio e o cliente do projeto
create policy sub_arquivos_read on public.sub_arquivos for select to authenticated
  using ((select public.is_studio()) or public.owns_project(project_id));
-- envio: studio, ou o cliente numa sub-etapa dele, com o arquivo na pasta
-- do projeto
create policy sub_arquivos_insert on public.sub_arquivos for insert to authenticated
  with check (
    (select public.is_studio())
    or (
      sent_by = 'client'
      and public.owns_project(project_id)
      and storage_path like project_id::text || '/%'
      and exists (
        select 1 from public.stage_subs b join public.stages s on s.id = b.stage_id
        where b.id = sub_id and s.project_id = sub_arquivos.project_id
          and b.responsible = 'cliente' and not b.done
      )
    )
  );
-- remoção: studio, ou o cliente tirando um arquivo que ele mesmo mandou
-- enquanto o pedido está aberto
create policy sub_arquivos_delete on public.sub_arquivos for delete to authenticated
  using (
    (select public.is_studio())
    or (
      sent_by = 'client'
      and public.owns_project(project_id)
      and exists (select 1 from public.stage_subs b where b.id = sub_id and not b.done)
    )
  );

-- Arquivos que já tinham sido mandados pelo jeito antigo (um por
-- sub-etapa) passam para a lista nova; essas sub-etapas viram pedidos.
insert into public.sub_arquivos (sub_id, project_id, name, storage_path, sent_by)
select b.id, s.project_id, coalesce(b.file_name, 'arquivo'), b.storage_path, 'client'
  from public.stage_subs b join public.stages s on s.id = b.stage_id
 where b.storage_path is not null
   and not exists (select 1 from public.sub_arquivos a where a.sub_id = b.id and a.storage_path = b.storage_path);
update public.stage_subs set pede_arquivos = true
 where storage_path is not null and pede_arquivos = false;
