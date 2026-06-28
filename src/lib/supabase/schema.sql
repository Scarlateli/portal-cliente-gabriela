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
  notes text
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

-- ============================================================
-- RLS (Row Level Security) — cliente só enxerga o próprio projeto.
-- Habilite o RLS em cada tabela e crie as policies.
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

-- Função auxiliar: o usuário logado é do studio?
create or replace function is_studio()
returns boolean language sql stable as $$
  select exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'studio'
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

-- Modelo p/ tabelas filhas (repita trocando o nome da tabela):
-- studio faz tudo; cliente só lê linhas de projetos dele.
create policy "stages_studio_all" on stages
  for all using (is_studio()) with check (is_studio());
create policy "stages_client_read" on stages
  for select using (
    exists (select 1 from projects p where p.id = stages.project_id and p.client_id = auth.uid())
  );

-- TODO: criar policies equivalentes para stage_subs, documents, contracts,
-- payments, installments, quotes, quote_comments e events. Para orçamentos,
-- o cliente PRECISA de update no "status" (aprovar/reprovar) — crie uma policy
-- de update restrita às colunas/linhas dos projetos dele.
