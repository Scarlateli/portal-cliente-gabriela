-- ============================================================
-- Portal do Cliente — schema Supabase (PostgreSQL)
-- Rode no SQL Editor do Supabase. Ajuste conforme necessário.
-- A autenticação usa o Supabase Auth (auth.users); a tabela "profiles"
-- guarda o papel (studio/client) e o nome exibido.
-- ============================================================

-- Perfis (1:1 com auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('studio', 'client')),
  name text not null,
  email text not null,
  created_at timestamptz default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  client_id uuid not null references profiles (id) on delete restrict,
  status text not null default 'em_andamento' check (status in ('em_andamento', 'concluido')),
  address text,
  start date,
  due date,
  completed_at date,
  access_until date,
  created_at timestamptz default now()
);

create table if not exists stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  ord int not null default 1,
  title text not null,
  category text not null,
  status text not null default 'a_fazer' check (status in ('a_fazer', 'em_andamento', 'concluida')),
  owner text not null default 'studio' check (owner in ('studio', 'client')),
  start date,
  "end" date,
  "time" text,
  link text,
  presencial boolean default false,
  "desc" text,
  rescheduled_from date
);

create table if not exists stage_subs (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references stages (id) on delete cascade,
  title text not null,
  done boolean default false
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  name text not null,
  type text not null,
  size text,
  date date default now(),
  storage_path text -- caminho no Supabase Storage (bucket de PDFs)
);

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  kind text not null default 'contrato' check (kind in ('contrato', 'termo')),
  name text not null,
  sig_status text not null default 'rascunho' check (sig_status in ('rascunho', 'enviado', 'assinado')),
  provider text,
  signer text,
  signed_at date
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  total numeric(12, 2) not null
);

create table if not exists installments (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments (id) on delete cascade,
  n int not null,
  amount numeric(12, 2) not null,
  due date not null,
  status text not null default 'pendente' check (status in ('pendente', 'pago')),
  paid_at date
);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  segment text not null,
  supplier text not null,
  amount numeric(12, 2) not null,
  file_name text,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'reprovado')),
  studio_note text,
  decided_at date,
  contact text,
  deadline text,
  payment text,
  contract_status text default 'a_iniciar',
  notes text,
  storage_path text -- PDF do orçamento no Storage (opcional)
);

create table if not exists quote_comments (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes (id) on delete cascade,
  author text not null check (author in ('studio', 'client')),
  body text not null,
  at timestamptz default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  date date not null,
  title text not null,
  kind text default 'evento',
  time text, -- horário (Etapa 4)
  link text  -- link da reunião online (Etapa 4)
);

-- Templates de etapas (ferramenta do studio; clientes não acessam).
create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates (id) on delete cascade,
  title text not null,
  category text not null,
  "desc" text,
  ord int not null default 1,
  subs jsonb not null default '[]'::jsonb -- sub-etapas do item (Etapa 2)
);

-- ============================================================
-- RLS (Row Level Security) — cliente só enxerga o próprio projeto.
-- ============================================================
alter table profiles enable row level security;
alter table projects enable row level security;
alter table stages enable row level security;
alter table stage_subs enable row level security;
alter table documents enable row level security;
alter table contracts enable row level security;
alter table payments enable row level security;
alter table installments enable row level security;
alter table quotes enable row level security;
alter table quote_comments enable row level security;
alter table events enable row level security;
alter table templates enable row level security;
alter table template_items enable row level security;

-- Função auxiliar: o usuário logado é do studio?
-- search_path fixo ('') + schemas qualificados (hardening recomendado pelo
-- security advisor do Supabase para funções usadas em RLS).
-- SECURITY DEFINER: evita recursão infinita de RLS — estas funções são
-- usadas DENTRO das policies e leem tabelas que também têm policy; sem o
-- definer, a checagem chamaria a si mesma até estourar a pilha.
create or replace function public.is_studio()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'studio'
  );
$$;

-- Função auxiliar: o projeto pertence ao cliente logado?
create or replace function public.owns_project(pid uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    where p.id = pid
      and p.client_id = auth.uid()
      -- acesso do cliente expira 1 mês após a conclusão do projeto
      and (p.access_until is null or p.access_until >= (now() at time zone 'America/Sao_Paulo')::date)
  );
$$;

-- Perfil: cada um lê o próprio; studio lê todos.
create policy "profiles_self_or_studio" on profiles
  for select using (id = auth.uid() or is_studio());

-- Projetos: studio vê tudo; cliente vê só os seus.
create policy "projects_studio_all" on projects
  for all using (is_studio()) with check (is_studio());
create policy "projects_client_read" on projects
  for select using (client_id = auth.uid());

-- Etapas: studio tudo; cliente só lê as de projetos dele.
create policy "stages_studio_all" on stages
  for all using (is_studio()) with check (is_studio());
create policy "stages_client_read" on stages
  for select using (owns_project(project_id));

-- Sub-etapas: vínculo via stage -> project.
create policy "stage_subs_studio_all" on stage_subs
  for all using (is_studio()) with check (is_studio());
create policy "stage_subs_client_read" on stage_subs
  for select using (
    exists (
      select 1 from stages s
      where s.id = stage_subs.stage_id and owns_project(s.project_id)
    )
  );

-- Documentos.
create policy "documents_studio_all" on documents
  for all using (is_studio()) with check (is_studio());
create policy "documents_client_read" on documents
  for select using (owns_project(project_id));

-- Contratos: cliente lê e pode atualizar (assinatura simulada) os seus.
create policy "contracts_studio_all" on contracts
  for all using (is_studio()) with check (is_studio());
create policy "contracts_client_read" on contracts
  for select using (owns_project(project_id));
create policy "contracts_client_sign" on contracts
  for update using (owns_project(project_id)) with check (owns_project(project_id));

-- Pagamentos e parcelas: somente leitura para o cliente.
create policy "payments_studio_all" on payments
  for all using (is_studio()) with check (is_studio());
create policy "payments_client_read" on payments
  for select using (owns_project(project_id));

create policy "installments_studio_all" on installments
  for all using (is_studio()) with check (is_studio());
create policy "installments_client_read" on installments
  for select using (
    exists (
      select 1 from payments pay
      where pay.id = installments.payment_id and owns_project(pay.project_id)
    )
  );

-- Orçamentos: cliente lê; e pode ATUALIZAR (aprovar/reprovar) os seus.
-- (RLS é por linha; a restrição às colunas status/decided_at é garantida
--  pela aplicação — o cliente só dispara setQuoteStatus.)
create policy "quotes_studio_all" on quotes
  for all using (is_studio()) with check (is_studio());
create policy "quotes_client_read" on quotes
  for select using (owns_project(project_id));
create policy "quotes_client_decide" on quotes
  for update using (owns_project(project_id)) with check (owns_project(project_id));

-- Comentários de orçamento: cliente lê e INSERE nos projetos dele.
create policy "quote_comments_studio_all" on quote_comments
  for all using (is_studio()) with check (is_studio());
create policy "quote_comments_client_read" on quote_comments
  for select using (
    exists (
      select 1 from quotes q
      where q.id = quote_comments.quote_id and owns_project(q.project_id)
    )
  );
create policy "quote_comments_client_insert" on quote_comments
  for insert with check (
    author = 'client' and exists (
      select 1 from quotes q
      where q.id = quote_comments.quote_id and owns_project(q.project_id)
    )
  );

-- Eventos.
create policy "events_studio_all" on events
  for all using (is_studio()) with check (is_studio());
create policy "events_client_read" on events
  for select using (owns_project(project_id));

-- Templates: exclusivos do studio.
create policy "templates_studio_all" on templates
  for all using (is_studio()) with check (is_studio());
create policy "template_items_studio_all" on template_items
  for all using (is_studio()) with check (is_studio());

-- ============================================================
-- Storage: bucket privado "documentos" (PDFs).
-- Crie o bucket no painel (Storage > New bucket > "documentos", Private)
-- ou via SQL abaixo. O caminho dos arquivos começa com "<project_id>/...".
-- ============================================================
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

-- Studio: acesso total ao bucket. Cliente: lê arquivos de projetos dele
-- (o 1º segmento do caminho é o project_id).
create policy "storage_studio_all" on storage.objects
  for all using (bucket_id = 'documentos' and is_studio())
  with check (bucket_id = 'documentos' and is_studio());

create policy "storage_client_read" on storage.objects
  for select using (
    bucket_id = 'documentos'
    and owns_project((storage.foldername(name))[1]::uuid)
  );

-- Onda 2 do redesign: sub-etapas com tipo/responsável/prazo/reunião por item
alter table stage_subs
  add column if not exists kind text not null default 'tarefa',
  add column if not exists responsible text not null default 'studio',
  add column if not exists due date,
  add column if not exists "time" text,
  add column if not exists format text,
  add column if not exists link text;
alter table stage_subs
  add constraint stage_subs_kind_check check (kind in ('tarefa', 'reuniao', 'entrega'));
alter table stage_subs
  add constraint stage_subs_responsible_check check (responsible in ('studio', 'cliente', 'fornecedor'));
alter table stage_subs
  add constraint stage_subs_format_check check (format is null or format in ('online', 'presencial'));

-- Onda 4A: PDF anexado ao contrato/termo (mesmo bucket/prefixo dos documentos)
alter table contracts add column if not exists storage_path text;

-- Onda 4B/4C + Autentique: categoria (reservada) em documents; arquivo do
-- cliente nas sub-etapas; id do documento na Autentique; upload do cliente.
alter table documents add column if not exists category text not null default 'outros';
alter table stage_subs
  add column if not exists storage_path text,
  add column if not exists file_name text;
alter table contracts add column if not exists provider_doc_id text;
create policy "storage_client_upload" on storage.objects
  for insert with check (
    bucket_id = 'documentos'
    and owns_project((storage.foldername(name))[1]::uuid)
  );

-- Onda 4C: cliente anexa arquivo nas sub-etapas em que é responsável
create policy "stage_subs_client_attach" on stage_subs
  for update using (
    responsible = 'cliente'
    and exists (
      select 1 from stages s
      where s.id = stage_subs.stage_id and owns_project(s.project_id)
    )
  )
  with check (responsible = 'cliente');

-- hardening: RPC das funções de RLS fechado para anon (advisors)
revoke execute on function is_studio() from public, anon;
revoke execute on function owns_project(uuid) from public, anon;
grant execute on function is_studio() to authenticated, service_role;
grant execute on function owns_project(uuid) to authenticated, service_role;

-- link de assinatura do studio persistido (botão no cartão do contrato)
alter table contracts add column if not exists studio_sign_link text;

-- Endurecimento (08/08): índices nas FKs, RLS com auth.uid() avaliado uma vez
-- por consulta, e limites de upload aplicados no servidor.
create index if not exists idx_contracts_project on contracts(project_id);
create index if not exists idx_documents_project on documents(project_id);
create index if not exists idx_events_project on events(project_id);
create index if not exists idx_installments_payment on installments(payment_id);
create index if not exists idx_payments_project on payments(project_id);
create index if not exists idx_projects_client on projects(client_id);
create index if not exists idx_quote_comments_quote on quote_comments(quote_id);
create index if not exists idx_quotes_project on quotes(project_id);
create index if not exists idx_stage_subs_stage on stage_subs(stage_id);
create index if not exists idx_stages_project on stages(project_id);
create index if not exists idx_template_items_template on template_items(template_id);

drop policy if exists profiles_self_or_studio on profiles;
create policy profiles_self_or_studio on profiles
  for select using ((id = (select auth.uid())) or is_studio());
drop policy if exists projects_client_read on projects;
create policy projects_client_read on projects
  for select using (client_id = (select auth.uid()));

-- bucket "documentos": 20 MB e tipos permitidos (aplicado no servidor)
update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp','image/heic',
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
where id = 'documentos';

-- Consolidação das políticas RLS (08/08): uma política por comando,
-- com studio e cliente unidos por OR. Ver migração consolidar_politicas_rls.
-- Padrão: <tabela>_read (select), _insert, _update, _delete.

-- ============================================================
-- Etapas 5 e 6 (07/10/2026): respostas do cliente a documentos, termos e
-- contratos. Ver supabase/sql/2026-10-07-etapas-5-6-respostas-do-cliente.sql
-- ============================================================
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

-- ============================================================
-- Etapa 8 (07/10/2026): cadastro de fornecedores e pedido de negociação.
-- Ver supabase/sql/2026-10-07-etapa8-fornecedores-e-negociacao.sql
-- ============================================================
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

-- ============================================================
-- PERMISSÕES (RLS) — retrato fiel da produção em 07/10/2026
-- ============================================================
-- Gerado a partir de pg_policies do projeto acqagwwjdaoodmnmtpgp, depois
-- da rodada de ajustes da validação com a Gabriela. Este bloco também é o
-- fim do src/lib/supabase/schema.sql: apaga as políticas antigas criadas
-- no começo do arquivo (nomes *_studio_all / *_client_*) e recria as atuais,
-- uma por comando (studio OU cliente). Pode rodar mais de uma vez.
--
-- Regras de leitura rápida:
--   - studio (is_studio) faz tudo;
--   - cliente lê o que é dos projetos dele (owns_project, que também
--     respeita o acesso expirado) e só altera: sub-etapas sob a
--     responsabilidade dele, comentários em orçamentos e arquivos na pasta
--     do projeto. Respostas a documentos, termos, contratos e orçamentos
--     passam pelas funções responder_documento, responder_contrato e
--     decidir_orcamento (security definer), nunca por UPDATE direto.

-- ---------- políticas antigas (versões anteriores deste arquivo) ----------
drop policy if exists "contracts_client_read" on public.contracts;
drop policy if exists "contracts_client_sign" on public.contracts;
drop policy if exists "contracts_studio_all" on public.contracts;
drop policy if exists "documents_client_read" on public.documents;
drop policy if exists "documents_studio_all" on public.documents;
drop policy if exists "events_client_read" on public.events;
drop policy if exists "events_studio_all" on public.events;
drop policy if exists "installments_client_read" on public.installments;
drop policy if exists "installments_studio_all" on public.installments;
drop policy if exists "payments_client_read" on public.payments;
drop policy if exists "payments_studio_all" on public.payments;
drop policy if exists "projects_client_read" on public.projects;
drop policy if exists "projects_studio_all" on public.projects;
drop policy if exists "quote_comments_client_insert" on public.quote_comments;
drop policy if exists "quote_comments_client_read" on public.quote_comments;
drop policy if exists "quote_comments_studio_all" on public.quote_comments;
drop policy if exists "quotes_client_decide" on public.quotes;
drop policy if exists "quotes_client_read" on public.quotes;
drop policy if exists "quotes_studio_all" on public.quotes;
drop policy if exists "stage_subs_client_attach" on public.stage_subs;
drop policy if exists "stage_subs_client_read" on public.stage_subs;
drop policy if exists "stage_subs_studio_all" on public.stage_subs;
drop policy if exists "stages_client_read" on public.stages;
drop policy if exists "stages_studio_all" on public.stages;

-- ---------- políticas atuais ----------
drop policy if exists contracts_delete on public.contracts;
create policy contracts_delete on public.contracts as permissive for delete to public
  using (is_studio());
drop policy if exists contracts_insert on public.contracts;
create policy contracts_insert on public.contracts as permissive for insert to public
  with check (is_studio());
drop policy if exists contracts_read on public.contracts;
create policy contracts_read on public.contracts as permissive for select to public
  using ((is_studio() or owns_project(project_id)));
drop policy if exists contracts_update on public.contracts;
create policy contracts_update on public.contracts as permissive for update to public
  using ((select is_studio()))
  with check ((select is_studio()));

drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents as permissive for delete to public
  using (is_studio());
drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents as permissive for insert to public
  with check (is_studio());
drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents as permissive for select to public
  using ((is_studio() or owns_project(project_id)));
drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents as permissive for update to public
  using (is_studio())
  with check (is_studio());

drop policy if exists events_delete on public.events;
create policy events_delete on public.events as permissive for delete to public
  using (is_studio());
drop policy if exists events_insert on public.events;
create policy events_insert on public.events as permissive for insert to public
  with check (is_studio());
drop policy if exists events_read on public.events;
create policy events_read on public.events as permissive for select to public
  using ((is_studio() or owns_project(project_id)));
drop policy if exists events_update on public.events;
create policy events_update on public.events as permissive for update to public
  using (is_studio())
  with check (is_studio());

drop policy if exists fornecedores_studio on public.fornecedores;
create policy fornecedores_studio on public.fornecedores as permissive for all to authenticated
  using ((select is_studio()))
  with check ((select is_studio()));

drop policy if exists installments_delete on public.installments;
create policy installments_delete on public.installments as permissive for delete to public
  using (is_studio());
drop policy if exists installments_insert on public.installments;
create policy installments_insert on public.installments as permissive for insert to public
  with check (is_studio());
drop policy if exists installments_read on public.installments;
create policy installments_read on public.installments as permissive for select to public
  using ((is_studio() or (exists (select 1 from payments pay
    where ((pay.id = installments.payment_id) and owns_project(pay.project_id))))));
drop policy if exists installments_update on public.installments;
create policy installments_update on public.installments as permissive for update to public
  using (is_studio())
  with check (is_studio());

drop policy if exists payments_delete on public.payments;
create policy payments_delete on public.payments as permissive for delete to public
  using (is_studio());
drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments as permissive for insert to public
  with check (is_studio());
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments as permissive for select to public
  using ((is_studio() or owns_project(project_id)));
drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments as permissive for update to public
  using (is_studio())
  with check (is_studio());

drop policy if exists profiles_self_or_studio on public.profiles;
create policy profiles_self_or_studio on public.profiles as permissive for select to public
  using (((id = (select auth.uid())) or is_studio()));

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects as permissive for delete to public
  using (is_studio());
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects as permissive for insert to public
  with check (is_studio());
drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects as permissive for select to public
  using ((is_studio() or (client_id = (select auth.uid()))));
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects as permissive for update to public
  using (is_studio())
  with check (is_studio());

drop policy if exists quote_comments_delete on public.quote_comments;
create policy quote_comments_delete on public.quote_comments as permissive for delete to public
  using (is_studio());
drop policy if exists quote_comments_insert on public.quote_comments;
create policy quote_comments_insert on public.quote_comments as permissive for insert to public
  with check ((is_studio() or ((author = 'client'::text) and (exists (select 1 from quotes q
    where ((q.id = quote_comments.quote_id) and owns_project(q.project_id)))))));
drop policy if exists quote_comments_read on public.quote_comments;
create policy quote_comments_read on public.quote_comments as permissive for select to public
  using ((is_studio() or (exists (select 1 from quotes q
    where ((q.id = quote_comments.quote_id) and owns_project(q.project_id))))));
drop policy if exists quote_comments_update on public.quote_comments;
create policy quote_comments_update on public.quote_comments as permissive for update to public
  using (is_studio())
  with check (is_studio());

drop policy if exists quotes_delete on public.quotes;
create policy quotes_delete on public.quotes as permissive for delete to public
  using (is_studio());
drop policy if exists quotes_insert on public.quotes;
create policy quotes_insert on public.quotes as permissive for insert to public
  with check (is_studio());
drop policy if exists quotes_read on public.quotes;
create policy quotes_read on public.quotes as permissive for select to public
  using ((is_studio() or owns_project(project_id)));
drop policy if exists quotes_update on public.quotes;
create policy quotes_update on public.quotes as permissive for update to public
  using ((select is_studio()))
  with check ((select is_studio()));

drop policy if exists stage_subs_delete on public.stage_subs;
create policy stage_subs_delete on public.stage_subs as permissive for delete to public
  using (is_studio());
drop policy if exists stage_subs_insert on public.stage_subs;
create policy stage_subs_insert on public.stage_subs as permissive for insert to public
  with check (is_studio());
drop policy if exists stage_subs_read on public.stage_subs;
create policy stage_subs_read on public.stage_subs as permissive for select to public
  using ((is_studio() or (exists (select 1 from stages s
    where ((s.id = stage_subs.stage_id) and owns_project(s.project_id))))));
drop policy if exists stage_subs_update on public.stage_subs;
create policy stage_subs_update on public.stage_subs as permissive for update to public
  using ((is_studio() or ((responsible = 'cliente'::text) and (exists (select 1 from stages s
    where ((s.id = stage_subs.stage_id) and owns_project(s.project_id)))))))
  with check ((is_studio() or ((responsible = 'cliente'::text) and (exists (select 1 from stages s
    where ((s.id = stage_subs.stage_id) and owns_project(s.project_id)))))));

drop policy if exists stages_delete on public.stages;
create policy stages_delete on public.stages as permissive for delete to public
  using (is_studio());
drop policy if exists stages_insert on public.stages;
create policy stages_insert on public.stages as permissive for insert to public
  with check (is_studio());
drop policy if exists stages_read on public.stages;
create policy stages_read on public.stages as permissive for select to public
  using ((is_studio() or owns_project(project_id)));
drop policy if exists stages_update on public.stages;
create policy stages_update on public.stages as permissive for update to public
  using (is_studio())
  with check (is_studio());

drop policy if exists template_items_studio_all on public.template_items;
create policy template_items_studio_all on public.template_items as permissive for all to public
  using (is_studio())
  with check (is_studio());
drop policy if exists templates_studio_all on public.templates;
create policy templates_studio_all on public.templates as permissive for all to public
  using (is_studio())
  with check (is_studio());

drop policy if exists storage_client_read on storage.objects;
create policy storage_client_read on storage.objects as permissive for select to public
  using (((bucket_id = 'documentos'::text) and owns_project(((storage.foldername(name))[1])::uuid)));
drop policy if exists storage_client_upload on storage.objects;
create policy storage_client_upload on storage.objects as permissive for insert to public
  with check (((bucket_id = 'documentos'::text) and owns_project(((storage.foldername(name))[1])::uuid)));
drop policy if exists storage_studio_all on storage.objects;
create policy storage_studio_all on storage.objects as permissive for all to public
  using (((bucket_id = 'documentos'::text) and is_studio()))
  with check (((bucket_id = 'documentos'::text) and is_studio()));

-- ============================================================
-- Rodada 3 (19/10/2026): endereço completo, vocativo, tipos e ordem das sub-etapas
-- (mesmo conteúdo de supabase/sql/2026-10-19-rodada3-endereco-vocativo-subetapas.sql)
-- ============================================================
alter table public.projects
  add column if not exists address_complement text,
  add column if not exists neighborhood text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists cep text,
  add column if not exists greeting text;

-- Sub-etapas com os mesmos tipos das etapas, mais "outro" com nome livre
-- (kind_label), e uma ordem própria para poder subir e descer.
alter table public.stage_subs drop constraint if exists stage_subs_kind_check;
alter table public.stage_subs add constraint stage_subs_kind_check
  check (kind in ('tarefa', 'reuniao', 'entrega', 'visita', 'documentacao', 'producao', 'outro'));
alter table public.stage_subs
  add column if not exists kind_label text,
  add column if not exists ord integer not null default 0;
alter table public.stage_subs drop constraint if exists stage_subs_kind_label_check;
alter table public.stage_subs add constraint stage_subs_kind_label_check
  check (kind_label is null or char_length(kind_label) <= 40);

-- Ordem inicial das sub-etapas que já existem: a ordem em que foram gravadas.
update public.stage_subs b
   set ord = x.n
  from (select id, row_number() over (partition by stage_id order by ctid) as n
          from public.stage_subs) x
 where x.id = b.id and b.ord = 0;

-- ============================================================
-- Rodada 4 (20/10/2026): aprovação de etapa, ajustes em documentos, envios do cliente
-- (mesmo conteúdo de supabase/sql/2026-10-20-rodada4-aprovacoes-e-envios-do-cliente.sql)
-- ============================================================
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

-- ============================================================
-- Rodada 5 (20/10/2026): nome do cliente por projeto e categorias de documento
-- ============================================================
alter table public.projects add column if not exists client_name text;
update public.projects p
   set client_name = pr.name
  from public.profiles pr
 where pr.id = p.client_id and p.client_name is null;

-- Categorias de documento: saem "Briefing" e "Contrato" (contratos ficam
-- na aba Contratos e Termos). O que estava nelas vai para Documentos Gerais.
update public.documents set type = 'geral' where type in ('briefing', 'contrato');

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
