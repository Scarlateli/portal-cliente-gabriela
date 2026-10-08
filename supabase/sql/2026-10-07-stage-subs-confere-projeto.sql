-- Correção encontrada na validação pós-deploy (07/10/2026).
-- A edição de sub-etapas pelo cliente conferia o projeto só ANTES da edição
-- (using). A checagem do resultado (with check) não conferia, então dava
-- para mover uma sub-etapa sob responsabilidade do cliente para uma etapa de
-- outro projeto, sabendo o identificador. Agora confere nos dois lados.
alter policy stage_subs_update on public.stage_subs
  with check (
    public.is_studio() or (
      responsible = 'cliente'
      and exists (select 1 from public.stages s where s.id = stage_subs.stage_id and public.owns_project(s.project_id))
    )
  );
