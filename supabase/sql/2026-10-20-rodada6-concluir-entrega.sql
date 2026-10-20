-- ============================================================
-- Rodada 6 (20/10/2026): visão do cliente
--   "Concluir entrega" nos Envios do Cliente: o cliente avisa que mandou
--   tudo; a partir daí não mexe mais nos arquivos nem no recado, até o
--   studio devolver o pedido. Também fecha uma brecha antiga: o cliente
--   só consegue mudar o recado das sub-etapas dele, nada mais.
-- Só acrescenta (coluna, função, gatilho e políticas restritivas novas);
-- não remove nada. Pode rodar mais de uma vez.
-- ============================================================

alter table public.stage_subs add column if not exists entregue_em timestamptz;

-- O cliente conclui a entrega de um pedido de arquivos dele.
create or replace function public.concluir_entrega(p_sub uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b record;
begin
  select bs.id, bs.pede_arquivos, bs.responsible, bs.done, bs.entregue_em, s.project_id
    into b
    from public.stage_subs bs
    join public.stages s on s.id = bs.stage_id
   where bs.id = p_sub;
  if not found or not public.owns_project(b.project_id) then
    raise exception 'Pedido não encontrado.';
  end if;
  if not b.pede_arquivos or b.responsible <> 'cliente' then
    raise exception 'Este item não é um pedido de arquivos seu.';
  end if;
  if b.done or b.entregue_em is not null then
    raise exception 'Este pedido já foi entregue.';
  end if;
  if not exists (select 1 from public.sub_arquivos a where a.sub_id = p_sub) then
    raise exception 'Envie pelo menos um arquivo antes de concluir a entrega.';
  end if;
  update public.stage_subs set entregue_em = now() where id = p_sub;
end
$$;
revoke all on function public.concluir_entrega(uuid) from public, anon;
grant execute on function public.concluir_entrega(uuid) to authenticated;

-- Pelo site (papel authenticated), o cliente só muda o recado, e só
-- enquanto o pedido está aberto. Studio, funções do banco e funções do
-- servidor não passam por esta trava.
create or replace function public.proteger_sub_do_cliente()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or (select public.is_studio()) then
    return new;
  end if;
  if (to_jsonb(new) - 'client_note') is distinct from (to_jsonb(old) - 'client_note') then
    raise exception 'O cliente só pode mudar o recado do pedido.';
  end if;
  if old.done or old.entregue_em is not null then
    raise exception 'Esta entrega já foi concluída; o recado não pode mais mudar.';
  end if;
  return new;
end
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'stage_subs_proteger_cliente') then
    create trigger stage_subs_proteger_cliente
      before update on public.stage_subs
      for each row execute function public.proteger_sub_do_cliente();
  end if;
end
$$;

-- Entrega concluída: o cliente não manda nem tira arquivos (restritivas
-- somam-se às políticas que já existem).
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'sub_arquivos' and policyname = 'sub_arquivos_insert_aberto') then
    create policy sub_arquivos_insert_aberto on public.sub_arquivos
      as restrictive for insert to authenticated
      with check (
        (select public.is_studio())
        or not exists (select 1 from public.stage_subs b where b.id = sub_id and b.entregue_em is not null)
      );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'sub_arquivos' and policyname = 'sub_arquivos_delete_aberto') then
    create policy sub_arquivos_delete_aberto on public.sub_arquivos
      as restrictive for delete to authenticated
      using (
        (select public.is_studio())
        or not exists (select 1 from public.stage_subs b where b.id = sub_id and b.entregue_em is not null)
      );
  end if;
end
$$;
