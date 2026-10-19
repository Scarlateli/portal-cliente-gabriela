-- Rodada 3 (revisão da Gabriela em 19/10/2026).
-- Só acréscimos: o código anterior do portal continua funcionando antes e
-- depois desta mudança, então ela entra ANTES de publicar o código novo.
-- Aplicada no projeto em 19/10/2026.

-- Endereço completo do projeto. "address" continua sendo rua e número;
-- as telas mostram a versão curta, mas tudo fica cadastrado.
-- "greeting" é o vocativo: como o portal cumprimenta quem acessa
-- ("Marília e Vitor", "Família Silva"). Os dados do contrato continuam no
-- nome do cliente.
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
