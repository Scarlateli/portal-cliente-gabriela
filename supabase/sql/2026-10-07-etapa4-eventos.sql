-- Etapa 4 — horário e link nos eventos criados no calendário.
-- Aplicada no projeto em 07/10/2026 (migração etapa4_horario_e_link_em_eventos).
alter table public.events add column if not exists time text;
alter table public.events add column if not exists link text;
