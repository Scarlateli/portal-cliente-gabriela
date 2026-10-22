-- ============================================================
-- Rodada 11 (22/10/2026): termo automático ao aprovar etapa
--   Quando o cliente aprova uma etapa na Linha do Tempo, nasce na hora um
--   "Termo de Aprovação – <etapa>" em Contratos e Termos, já aprovado, com
--   nome, data e hora (o PDF sai pelo botão "Baixar comprovante").
--   O studio pode editar e excluir esse termo. stage_id liga o termo à
--   etapa (se a etapa for excluída, o termo fica).
-- Só acrescenta: coluna nova e a função responder_etapa com o mesmo
-- cabeçalho (create or replace). Pode rodar mais de uma vez.
-- ============================================================
alter table public.contracts
  add column if not exists stage_id uuid references public.stages (id) on delete set null;
create index if not exists idx_contracts_stage on public.contracts (stage_id);

create or replace function public.responder_etapa(
  p_etapa uuid, p_decisao text, p_nome text default null, p_mensagem text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s record; msg text := nullif(trim(coalesce(p_mensagem, '')), '');
begin
  select st.id, st.project_id, st.approval, st.title, p.name as projeto
    into s
    from public.stages st join public.projects p on p.id = st.project_id
   where st.id = p_etapa
   for update of st;
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
    -- o termo da etapa, já aprovado, em Contratos e Termos
    insert into public.contracts
      (project_id, stage_id, kind, method, name, body, sig_status, provider, signer, signed_at, responded_at, response_note)
    values
      (s.project_id, s.id, 'termo', 'aceite', 'Termo de Aprovação – ' || s.title,
       'O cliente declara que a etapa "' || s.title || '" do projeto "' || s.projeto
         || '" foi concluída e aprovada.',
       'assinado', 'Portal', trim(p_nome), current_date, now(), left(msg, 2000));
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

-- etapas já aprovadas antes desta rodada ganham o termo delas
insert into public.contracts
  (project_id, stage_id, kind, method, name, body, sig_status, provider, signer, signed_at, responded_at, response_note)
select st.project_id, st.id, 'termo', 'aceite', 'Termo de Aprovação – ' || st.title,
       'O cliente declara que a etapa "' || st.title || '" do projeto "' || p.name || '" foi concluída e aprovada.',
       'assinado', 'Portal', st.approval_name, st.approval_at::date, st.approval_at, st.approval_note
  from public.stages st join public.projects p on p.id = st.project_id
 where st.approval = 'aprovada' and st.approval_at is not null
   and not exists (select 1 from public.contracts c where c.stage_id = st.id);
