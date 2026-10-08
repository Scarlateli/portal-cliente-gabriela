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
