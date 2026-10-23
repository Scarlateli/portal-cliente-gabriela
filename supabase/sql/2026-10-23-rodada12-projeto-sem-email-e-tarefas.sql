-- ============================================================
-- Rodada 12 (23/10/2026)
--   1) Projeto pode nascer sem cliente vinculado: a Gabriela monta tudo e
--      libera o acesso depois, ao informar o e-mail (client_id passa a
--      aceitar vazio; quem não tem cliente não é visto por nenhum cliente).
--   2) Observação do cliente em cada arquivo enviado (anotar_arquivo).
--   3) Cliente conclui uma tarefa dele que não pede arquivos
--      (concluir_tarefa) — antes ela virava pendência sem ter o que fazer.
-- Só acrescenta/relaxa; pode rodar mais de uma vez.
-- ============================================================
alter table public.projects alter column client_id drop not null;

alter table public.sub_arquivos add column if not exists nota text;

create or replace function public.anotar_arquivo(p_arquivo uuid, p_nota text)
returns void language plpgsql security definer set search_path = '' as $$
declare a record;
begin
  select ar.id, ar.project_id, ar.sent_by, b.done, b.entregue_em
    into a
    from public.sub_arquivos ar join public.stage_subs b on b.id = ar.sub_id
   where ar.id = p_arquivo;
  if a.id is null then
    raise exception 'Arquivo não encontrado.' using errcode = '42501';
  end if;
  if not (select public.is_studio()) then
    if not public.owns_project(a.project_id) or a.sent_by <> 'client' then
      raise exception 'Arquivo não encontrado.' using errcode = '42501';
    end if;
    if a.done or a.entregue_em is not null then
      raise exception 'Esta entrega já foi concluída; a observação não pode mais mudar.';
    end if;
  end if;
  update public.sub_arquivos
     set nota = nullif(left(trim(coalesce(p_nota, '')), 500), '')
   where id = p_arquivo;
end $$;
revoke all on function public.anotar_arquivo(uuid, text) from public, anon;
grant execute on function public.anotar_arquivo(uuid, text) to authenticated;

create or replace function public.concluir_tarefa(p_sub uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare b record;
begin
  select bs.id, bs.responsible, bs.pede_arquivos, bs.done, s.project_id
    into b
    from public.stage_subs bs join public.stages s on s.id = bs.stage_id
   where bs.id = p_sub;
  if b.id is null or not public.owns_project(b.project_id) then
    raise exception 'Tarefa não encontrada.' using errcode = '42501';
  end if;
  if b.responsible <> 'cliente' or b.pede_arquivos then
    raise exception 'Esta tarefa não pode ser concluída por aqui.';
  end if;
  if b.done then
    raise exception 'Esta tarefa já foi concluída.';
  end if;
  update public.stage_subs set done = true where id = p_sub;
end $$;
revoke all on function public.concluir_tarefa(uuid) from public, anon;
grant execute on function public.concluir_tarefa(uuid) to authenticated;
