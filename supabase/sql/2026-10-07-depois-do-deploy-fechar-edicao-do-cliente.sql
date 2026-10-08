-- APLICAR SÓ DEPOIS que o código das etapas 5 a 8 estiver no ar.
--
-- Até aqui, o cliente tinha permissão de UPDATE em qualquer campo dos
-- contratos e orçamentos do próprio projeto (a tela só mostrava aprovar ou
-- recusar, mas a permissão no banco era ampla). Agora o cliente age só
-- pelas funções responder_contrato e decidir_orcamento, então a edição
-- direta volta a ser exclusiva do studio.
--
-- Se aplicado antes do deploy, o portal antigo perde o botão de aprovar
-- orçamento do cliente até o código novo chegar.
alter policy contracts_update on public.contracts
  using ((select public.is_studio())) with check ((select public.is_studio()));
alter policy quotes_update on public.quotes
  using ((select public.is_studio())) with check ((select public.is_studio()));
