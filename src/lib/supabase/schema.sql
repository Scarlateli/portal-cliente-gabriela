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
  kind text default 'evento'
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
  ord int not null default 1
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
create or replace function is_studio()
returns boolean language sql stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'studio'
  );
$$;

-- Função auxiliar: o projeto pertence ao cliente logado?
create or replace function owns_project(pid uuid)
returns boolean language sql stable
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
