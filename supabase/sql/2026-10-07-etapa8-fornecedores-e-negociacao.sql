-- Etapa 8 — cadastro prévio de fornecedores e pedido de negociação.
-- Parte ADITIVA: o código anterior do portal continua funcionando.
-- Aplicada no projeto em 07/10/2026, em duas partes (etapa8a_fornecedores_e_funcao_decidir
-- e etapa8b_status_negociacao): a versão única foi cancelada três vezes,
-- provavelmente pelo "drop policy if exists" de uma política que ainda não existia.

-- Cadastro de fornecedores do studio (vale para todos os projetos). Ao criar
-- um orçamento, a Gabriela escolhe um daqui e os dados vêm preenchidos.
-- Só o studio enxerga e edita.
create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment text,
  contact text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.fornecedores enable row level security;
drop policy if exists fornecedores_studio on public.fornecedores;
create policy fornecedores_studio on public.fornecedores
  for all to authenticated
  using ((select public.is_studio())) with check ((select public.is_studio()));

-- Orçamento passa a ter o estado "em negociação" (pedido do cliente).
alter table public.quotes drop constraint if exists quotes_status_check;
alter table public.quotes add constraint quotes_status_check
  check (status in ('pendente', 'aprovado', 'reprovado', 'negociacao'));

-- O cliente decide sobre um orçamento por esta função (aprovar, reprovar ou
-- pedir negociação, com mensagem). Ela confere que o orçamento é de um
-- projeto dele e que ainda está pendente, e altera só o status.
create or replace function public.decidir_orcamento(
  p_orcamento uuid, p_decisao text, p_mensagem text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare q record; msg text := nullif(trim(coalesce(p_mensagem, '')), '');
begin
  select id, project_id, status into q from public.quotes where id = p_orcamento for update;
  if q.id is null or not public.owns_project(q.project_id) then
    raise exception 'Orçamento não encontrado.' using errcode = '42501';
  end if;
  if q.status <> 'pendente' then
    raise exception 'Este orçamento não está aguardando a sua decisão.';
  end if;
  if p_decisao = 'aprovar' then
    update public.quotes set status = 'aprovado', decided_at = current_date where id = p_orcamento;
  elsif p_decisao = 'reprovar' then
    update public.quotes set status = 'reprovado', decided_at = current_date where id = p_orcamento;
  elsif p_decisao = 'negociar' then
    if msg is null then
      raise exception 'Conte o que você gostaria de negociar.';
    end if;
    update public.quotes set status = 'negociacao' where id = p_orcamento;
  else
    raise exception 'Decisão inválida.';
  end if;
  if msg is not null then
    insert into public.quote_comments (quote_id, author, body) values (p_orcamento, 'client', msg);
  end if;
end $$;

revoke all on function public.decidir_orcamento(uuid, text, text) from public, anon;
grant execute on function public.decidir_orcamento(uuid, text, text) to authenticated;
