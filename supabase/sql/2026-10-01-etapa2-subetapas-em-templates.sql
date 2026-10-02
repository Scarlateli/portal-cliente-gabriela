-- Etapa 2 — sub-etapas em templates.
-- Cada item de template passa a guardar a lista das suas sub-etapas
-- (título, tipo e responsável). Coluna nova com valor padrão: o código atual
-- do portal continua funcionando antes e depois desta mudança, então ela
-- pode (e deve) ser aplicada ANTES de publicar o código da Etapa 2.
alter table public.template_items
  add column if not exists subs jsonb not null default '[]'::jsonb;
