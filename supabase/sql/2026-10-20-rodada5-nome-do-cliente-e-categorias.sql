-- Rodada 5 (visão do studio, revisão de 20/10/2026 à tarde).
-- Só acréscimo e atualização de dados: o código anterior continua
-- funcionando. Entra ANTES do código. Aplicada no projeto em 20/10/2026.

-- Nome do cliente como foi digitado no cadastro DESTE projeto. Antes, o
-- portal mostrava o nome do perfil, que é o do primeiro cadastro daquele
-- e-mail (por isso um projeto novo aparecia com o nome de outro).
alter table public.projects add column if not exists client_name text;
update public.projects p
   set client_name = pr.name
  from public.profiles pr
 where pr.id = p.client_id and p.client_name is null;

-- Categorias de documento: saem "Briefing" e "Contrato" (contratos ficam
-- na aba Contratos e Termos). O que estava nelas vai para Documentos Gerais.
update public.documents set type = 'geral' where type in ('briefing', 'contrato');
