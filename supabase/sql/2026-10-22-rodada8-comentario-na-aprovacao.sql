-- ============================================================
-- Rodada 8 (22/10/2026): visão do cliente
--   Ao aprovar (ou assinar) um documento, o cliente pode deixar um
--   comentário, que fica em response_note (o mesmo campo da mensagem de
--   "pedir ajustes"). Mesma assinatura da função; só troca o corpo.
-- ============================================================
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
      set response = 'assinado', responded_at = now(), responded_name = trim(p_nome),
          response_note = left(msg, 2000)
      where id = p_documento;
  else
    update public.documents
      set response = 'aprovado', responded_at = now(),
          responded_name = (select name from public.profiles where id = (select auth.uid())),
          response_note = left(msg, 2000)
      where id = p_documento;
  end if;
end $$;
revoke all on function public.confirmar_documento(uuid, text, text, text) from public, anon;
grant execute on function public.confirmar_documento(uuid, text, text, text) to authenticated;
