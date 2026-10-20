# Portal da Gabriela — status, pendências e melhorias

Documento vivo, atualizado ao fim da sessão de 20/07/2026. Serve como
panorama para qualquer agente (Claude, Warp) ou pessoa que pegar o projeto.

Produção: <https://portal.gabrielalendecker.com> (Vercel) ·
Banco/Auth/Storage: Supabase (projeto `acqagwwjdaoodmnmtpgp`) ·
Repositório: `Scarlateli/portal-cliente-gabriela`.

---

## 1. O que está pronto e no ar

### Produto
- **Autenticação** com dois papéis (studio e cliente), primeiro acesso com
  senha provisória por e-mail, tela "Crie sua senha" e **"Esqueci minha
  senha"** ponta a ponta (validado em produção).
- **Projetos**: criação com convite automático do cliente por e-mail
  (Resend), listagem ativa/concluída, finalização com janela de acesso
  pós-conclusão, exclusão, histórico em PDF.
- **Linha do tempo** com etapas e **sub-etapas** completas: tipo
  (tarefa/reunião/entrega), responsável (studio/cliente/fornecedor), prazo,
  e — quando reunião — data pontual, horário, online/presencial e link.
- **Calendário** derivado das etapas e das sub-etapas (reuniões e entregas).
- **Documentos** com upload, tipos e filtros; **cliente envia arquivo** nas
  sub-etapas em que é o responsável.
- **Contratos e termos** com PDF anexado, "Ver PDF" (URL assinada) e
  exclusão (remove arquivo + registro).
- **Assinatura eletrônica (Autentique)**: envio do PDF pela plataforma,
  **duas partes** (studio + cliente), botão "Assinar como studio" no cartão
  e verificação ativa que marca **"assinado" quando todos assinaram**.
- **Pagamentos, orçamentos, fornecedores** (das ondas anteriores).
- **Templates** de etapas: criar, aplicar a um projeto, salvar as etapas de
  um projeto como template e excluir.
- **Redesign completo** (ondas 1 a 4): paleta greige + vinho, Cormorant
  Garamond nos títulos, login dividido, hero editorial com régua de números,
  timeline com ordinais, rodapé "Falar com o studio" (WhatsApp).
- **F5 mantém a tela** (deep-link `#p=<id>`) e **atualização instantânea**
  das ações (otimista + refetch).

### Infraestrutura
- 5 Edge Functions ativas: `invite-client`, `forgot-password`,
  `autentique-send`, `autentique-check`, `autentique-webhook`.
- RLS em todas as tabelas; funções `is_studio()` / `owns_project()` com
  EXECUTE fechado para anônimos; Storage privado com policies por projeto.
- Testes unitários (12) + lint + build nos dois modos (mock e supabase) como
  portões obrigatórios de cada entrega.

---

## 2. Pendências (ordem sugerida)

### 2.1 Fechar o ciclo de assinatura — **em teste**
O envio, o botão do studio e a verificação estão no ar. Falta **um teste
completo com um terceiro real** (não a própria conta da Gabriela na
Autentique, que confunde as identidades studio/cliente):

1. Criar projeto de teste com e-mail de **outra pessoa** como cliente.
2. Contrato com PDF → "Enviar p/ assinatura".
3. Studio assina (botão "Assinar como studio" ou painel da Autentique).
4. A outra pessoa assina pelo e-mail dela.
5. Aba Contratos → status deve virar **"assinado"** com a data.

### 2.2 Validação da Gabriela (roteiro de 10 passos)
Login → primeiro acesso do cliente → etapa com sub-etapas (incluindo
reunião) → conferir calendário → marcar status/sub → salvar e reusar
template → subir documento → contrato com PDF e assinatura → cliente envia
arquivo numa sub dela → "Esqueci minha senha".

### 2.3 Itens técnicos abertos
| Item | Observação |
|---|---|
| Guarda anti-duplo-clique | Já existe em "Criar projeto"; replicar em "Nova etapa", "Novo documento" e "Novo contrato" |
| Limite de tamanho/tipo no upload | Hoje aceita qualquer arquivo; sugerido validar extensão e teto (ex.: 20 MB) antes de subir |
| Validação formal do webhook | `AUTENTIQUE_WEBHOOK_TOKEN` guardado, mas a Autentique nunca entregou um evento; quando entregar, verificar o header e passar a exigir |
| Backup do banco | Plano Free não tem backup automático; decidir entre Supabase Pro ou rotina de `pg_dump` |
| Proteção de senha vazada | Recurso Pro-only; indisponível no Free (registrado como aceito) |
| Tiles de documento | Lista atual é funcional; o redesign previa cartões por tipo de arquivo |
| Testes de ponta a ponta | Só há testes unitários; um smoke test (Playwright) cobriria login → projeto → documento |

### 2.4 Rotação de segredos (após os testes)
`RESEND_API_KEY`, `AUTENTIQUE_TOKEN` e a **senha do studio** passaram por
chat durante o desenvolvimento. Trocar todos e não compartilhar os novos.

---

## 3. Melhorias sugeridas (backlog priorizado)

**Alto valor, baixo esforço**
1. Notificar o cliente por e-mail quando houver novo documento, contrato
   para assinar ou mudança de etapa (a infra de e-mail já existe).
2. Estados vazios com orientação ("nenhuma etapa ainda — comece por…").
3. Mensagens de erro amigáveis para falha de upload (arquivo grande, rede).

**Médio**
4. Painel do studio com visão geral (projetos por status, pendências da
   semana, contratos aguardando assinatura).
5. Reordenar etapas e sub-etapas (arrastar).
6. Comentários por etapa entre studio e cliente.
7. Exportar o histórico do projeto em PDF com a identidade visual nova.

**Estratégico**
8. Área de fornecedores compartilhada entre projetos.
9. Registro de horas/atividades por projeto.
10. App instalável (PWA) para o cliente acompanhar pelo celular.

---

## 4. Arquitetura: site institucional + portal

### 4.1 O site precisa de banco de dados?
**Não para a v1.** O site é institucional (apresentação, portfólio,
contato). Conteúdo estático no próprio código já resolve, e isso o torna
mais rápido, mais barato e mais seguro.

Quando um banco passa a fazer sentido:
- **Formulário de contato** → não precisa de banco. Duas opções: link do
  WhatsApp (zero infraestrutura, é o que o portal já usa) ou uma Edge
  Function que envia e-mail pelo Resend (a chave já existe no Supabase).
- **Portfólio/blog editável pela Gabriela sem mexer em código** → aí sim.
  Nesse caso, **reusar o mesmo projeto Supabase** com tabelas próprias
  prefixadas (`site_projetos`, `site_posts`), com RLS liberando **apenas
  leitura pública** (`anon SELECT`) e escrita restrita ao studio. As
  tabelas do portal ficam intocadas.

**Regra de ouro:** o site pode usar a chave `anon` (é pública por
natureza), **nunca** a `service_role`. Se o site não tiver login, ele não
deve conseguir escrever nada.

### 4.2 Os dois podem ficar na mesma URL?
Dois aplicativos não ocupam a mesma URL exata, mas **compartilham o mesmo
domínio** — que é o padrão do mercado e já é o arranjo atual:

```
gabrielalendecker.com          → site institucional  (repositório novo)
portal.gabrielalendecker.com   → portal do cliente   (este repositório)
```

Como funciona: um domínio, dois projetos na Vercel. No painel da Vercel,
cada projeto reivindica seu domínio/subdomínio e a Vercel cuida do DNS e do
certificado HTTPS. O site linka para o portal no header ("Portal do
Cliente") e o portal pode linkar de volta no rodapé.

Alternativa possível, **não recomendada**: servir o portal num caminho
(`gabrielalendecker.com/portal`) via rewrites. Funciona, mas acopla os
deploys, complica cache e rotas, e não traz ganho real.

**Recomendação:** repositórios separados, deploys separados, subdomínio
para o portal, tokens visuais copiados (não importados) para o site.

### 4.3 O que o site herda do portal
- Paleta atual (ver `src/styles/theme.css`): fundo `#E3DFD2`, superfície
  `#F7F2E8`, tinta `#2F2119`, vinho `#4B1F1B`, creme `#F2E9DC`, hairline
  `rgba(63,32,25,.12)`.
- Tipografia: **Cormorant Garamond** (títulos) + **Jost** (interface), ambas
  do Google Fonts. A licença da Futura foi adquirida pela Gabriela — se for
  usá-la no site, confirmar que a licença cobre **uso web (webfont)**, que é
  diferente da licença de desktop.
- Assets de marca em `public/brand/`.
- Princípios: muito respiro, cantos discretos (4–6px), sem sombras fortes,
  filetes finos em vez de bordas pesadas.

---

## 5. Como este projeto é desenvolvido

- `AGENTS.md` é a fonte única de regras para agentes neste repositório.
- Portões obrigatórios antes de qualquer entrega: `npm run lint`,
  `npx vitest run`, e build nos dois modos (`VITE_DATA_SOURCE=mock` e
  `=supabase`).
- Dois modos de dados: `mock` (dados em memória, para desenvolvimento) e
  `supabase` (produção). Toda função nova precisa existir nos dois.
- Segredos **nunca** entram no repositório: ficam em Supabase → Edge
  Functions → Secrets e nas variáveis de ambiente da Vercel.


---

## Revisão de experiência — 28/09/2026

**Feito:** erros traduzidos para português claro (causa técnica recolhida em
"Detalhe técnico"); login refeito como formulário de verdade, com
preenchimento automático e recuperação de senha na própria tela; prévia do
site para WhatsApp/redes; rótulos de acessibilidade e "Pular para o
conteúdo".

**Ficou para depois, de propósito** (mudança larga demais na véspera da
validação):
- **Diálogos de confirmação** — 9 ações ainda usam a caixa cinza do
  navegador ("Excluir…?", "Finalizar o projeto?", "Enviar para
  assinatura?"). Funcionam, mas destoam do visual. Trocar por um diálogo
  próprio é um bom trabalho para o Claude Code: um componente só, aplicado
  nos 7 arquivos.
- **Nome do template** — "Salvar como template" ainda pede o nome numa
  caixa do navegador; entra junto com o item acima.


---

## Rodada de ajustes da validação com a Gabriela — 01/10/2026

Pedidos levantados por JP e Gabriela na sessão de validação, organizados em
etapas. Cada etapa é entregue e testada antes da próxima.

**Etapa 1 — Identidade visual** ✅ (entregue em 01/10)
Fonte Futura Std nos quatro pesos reais; paleta oficial (convertida dos
arquivos CMYK pelo perfil de cor embutido); logo oficial no lugar da versão
remontada; painel de entrada com logo vinho sobre bege; "Portal do Cliente"
vira "Portal do Projeto"; nome do projeto em Futura; número de documentos
sai do topo; e-mails de convite e de senha com logo e cores oficiais.

**Etapa 2 — Cadastro e templates (studio)** ✅ (entregue em 01/10)
Editar os dados do projeto depois de criado; escolher e ajustar o template
dentro do cadastro, antes de enviar o acesso; excluir projeto (com o código
digitado para confirmar; apaga também os arquivos do Storage); templates com
sub-etapas, agora editáveis. Mudança de banco em
`supabase/sql/2026-10-01-etapa2-subetapas-em-templates.sql`.

**Etapa 3 — Visão do cliente** ✅ (07/10)
Filtro das etapas na ordem Em andamento, Futuras, Concluídas, Todas, sem a
contagem entre parênteses; bloco de contato com a chamada "Tem alguma
dúvida?", a subchamada "Fale com nossa equipe" e o botão "Fale conosco".

**Etapa 4 — Calendário** ✅ (07/10; Google Agenda por link, sem conectar a conta)
Horário nas reuniões criadas pelo calendário; "Adicionar ao Google Agenda"
em cada evento.

**Etapa 5 — Documentos com aprovação** ✅ (07/10)
Para cada documento, a Gabriela escolhe: pede assinatura do cliente (feita
dentro do portal, sem Autentique) ou pede só um OK. Fica pendente para o
cliente até ele resolver.

**Etapa 6 — Termos e contratos** ✅ (07/10)
Termos: o cliente aprova ou recusa com um botão, sem PDF. Contratos: a
Gabriela escolhe entre a assinatura dentro do portal e a Autentique. O
contrato oficial do projeto continua pela Autentique.

**Etapa 7 — Notificações** ✅ (07/10; sino + janela ao entrar)
Sino com as pendências, para a Gabriela e para o cliente; janela de
pendências ao entrar, até que sejam resolvidas.

**Etapa 8 — Orçamentos e fornecedores** ✅ (07/10)
Cadastro prévio de fornecedores, escolhidos no orçamento com os dados já
preenchidos; o cliente pode pedir negociação de valor pelo portal.


### Banco — o que foi aplicado nesta rodada (tudo em produção)

| Arquivo em `supabase/sql/` | Aplicado | Observação |
|---|---|---|
| `2026-10-01-etapa2-subetapas-em-templates.sql` | 07/10 | o código da Etapa 2 subiu antes; a aba de templates falhou até aqui |
| `2026-10-07-etapa4-eventos.sql` | 07/10 | antes do código |
| `2026-10-07-etapas-5-6-respostas-do-cliente.sql` | 07/10 | antes do código; testado simulando dono, outro cliente e anônimo |
| `2026-10-07-etapa8-fornecedores-e-negociacao.sql` | 07/10 | **depois** do código (três tentativas canceladas); entrou em duas partes |
| `2026-10-07-depois-do-deploy-fechar-edicao-do-cliente.sql` | 07/10 | depois do deploy, como previsto |
| `2026-10-07-stage-subs-confere-projeto.sql` | 07/10 | correção encontrada na validação (abaixo) |

**Lição:** o código das etapas 5 a 8 ficou no ar alguns minutos sem a
mudança da Etapa 8; nesse intervalo o painel do studio e a decisão de
orçamentos falhavam. Mudança aditiva no banco vai SEMPRE antes do push.

### Validação pós-deploy (07/10/2026)

- GitHub `main` idêntico ao código entregue; deploy da Vercel pronto; nenhum
  erro de execução registrado.
- Portal real aberto no navegador: título, logo oficial e Futura Std
  carregados, nenhum arquivo falhando.
- Banco: todas as colunas lidas pelo código novo existem e respondem para
  cliente e studio, com o isolamento certo (cliente vê só o projeto dele).
- Funções do cliente testadas no banco real (transação desfeita): cliente de
  outro projeto, resposta dupla, assinatura sem nome, negociação sem
  mensagem e usuário anônimo são barrados.
- Brecha antiga fechada: o cliente não consegue mais marcar contrato como
  assinado nem mudar valor de orçamento por fora da tela (0 linhas).
- **Encontrado e corrigido:** a regra de edição de sub-etapas pelo cliente
  não conferia o projeto depois da edição (dava para mover uma sub-etapa
  para o projeto de outra pessoa, sabendo o identificador). Agora confere.
- **Encontrado e corrigido:** o `schema.sql` estava defasado da produção
  desde a consolidação das políticas (agosto). Ganhou, no fim, o retrato
  das permissões de produção (`supabase/sql/permissoes-producao.sql`) e foi
  conferido montando um banco do zero e comparando com a produção: tabelas,
  colunas, regras, políticas e funções idênticas.
- **Encontrado e corrigido:** a biblioteca de validação (Zod) testava
  `new Function` ao carregar, o que gerava um aviso da CSP no console.
- **CSP em modo bloqueio** (`Content-Security-Policy` no `vercel.json`, antes
  `-Report-Only`). Antes da troca, o build foi servido com os mesmos headers
  do `vercel.json` e todas as abas foram percorridas como cliente e como
  studio (20 telas, incluindo sino, painel, templates, fornecedores e
  histórico em PDF): nenhuma violação nem erro de console. Um controle
  positivo (imagem externa) confirmou que o detector acusa bloqueios.
  Se algo novo precisar carregar de outro domínio (fonte, imagem, API),
  é preciso incluí-lo na diretiva certa do `vercel.json`, senão o navegador
  bloqueia.

### Avisos do Supabase (esperados)

- Funções `security definer` executáveis por usuários logados: intencional
  (as três funções do cliente conferem a posse por dentro; `is_studio` e
  `owns_project` são usadas pelas políticas).
- Proteção contra senhas vazadas desligada: só existe no plano Pro (o
  projeto está no gratuito; ver `PLANO-PRODUCAO.md`). Enquanto isso, o
  mínimo de 8 caracteres deve valer também no servidor: Authentication →
  provedor Email → tamanho mínimo da senha = 8 (a interface já exige 8; a
  senha provisória do convite tem 12). Não exigir tipos de caractere: a
  senha provisória usa só minúsculas, números e hífen.
- Índices sem uso: volume ainda baixo; manter.

## Rodada 3 — revisão da Gabriela em 19/10/2026

Feedback em anotações sobre prints (iPad e computador) e na ata da reunião.

**Erro ao criar projeto ("Sua sessão expirou")** ✅
- Causa (logs do Supabase): sair do portal num aparelho encerrava a sessão
  em **todos** os aparelhos (`signOut` no modo padrão, global). Ela usava o
  iPad e o computador com a mesma conta; ao sair no computador, o iPad
  passava a receber 401 da função `invite-client` (`session_not_found`).
- Correção: sair encerra só o aparelho atual (`signOut({ scope: 'local' })`)
  e, se uma Edge Function responder 401, o portal renova a sessão uma vez e
  tenta de novo (`invocar` em `db-supabase.js`).
- Achado junto: cadastrar um projeto para um e-mail que **já** tinha acesso
  gerava senha provisória nova para esse cliente. Agora (`invite-client` v6,
  `reset: false`) o cliente que já criou a senha dele continua com ela; o
  projeto novo só aparece no portal dele. "Reenviar acesso" continua gerando
  senha nova. O convite por e-mail foi conferido no Resend (entregue).

**Capa e visual**
- "Portal do Projeto" com P maiúsculo; os dois blocos de cor do login
  viraram um fundo só. A foto de capa com névoa está pronta para entrar:
  ver `CAPA_LOGIN` em `src/lib/constants.js` (aguardando a foto da Gabriela).
- Nome do projeto azul no iPad: o Safari pinta de azul texto de botão sem
  cor definida (os cartões são botões). Corrigido.
- Setinhas para cima e para baixo nas abas, no computador: barra de rolagem
  do Windows. Escondida (a faixa continua rolando no toque e no trackpad).
- Painel do topo menor no computador; "Etapas do projeto" com respiro no
  cadastro; botões do fim do projeto (reenviar acesso, finalizar, editar,
  excluir) numa linha só, todos do mesmo tamanho; aba "Contratos e termos";
  "Cliente: …" escrito no painel e no projeto (o "teste 08/08" era o nome
  cadastrado do cliente de teste).

**Cadastro**
- Endereço completo: rua e número, complemento, bairro, CEP, cidade e
  estado. As telas mostram a forma curta; o histórico em PDF mostra com CEP.
- Vocativo ("Como o portal cumprimenta"): o portal diz "Olá, Marília e
  Vitor" em vez do nome do contrato. Em branco, usa o primeiro nome. Também
  usado no e-mail de convite.
- Vários acessos para o mesmo projeto (ex.: consultório com 3 médicos):
  deixado para depois, como combinado.

**Templates e etapas**
- Sub-etapas com os mesmos tipos das etapas (Reunião, Entrega, Visita
  técnica, Documentação, Produção), mais Tarefa e "Outro (escrever)".
- Etapa nova começa com o tipo "Etapa" (fase que agrupa sub-etapas, como
  Briefing), em vez de "Reunião".
- Sub-etapas sobem e descem com as setas (template, cadastro e linha do
  tempo), sem apagar e criar de novo.
- Templates aparecem recolhidos; "Editar" abre dentro do próprio template.
- "Salvar como template" agora leva as sub-etapas junto.

**Linha do tempo**
- Cada sub-etapa mostra, com nome, o tipo, o responsável (Studio, Cliente
  ou Fornecedor) e o prazo: "Sem prazo", "Até 03/02/2026", "Vence hoje" ou
  "Atrasada · venceu …" (em vermelho). Reunião e visita mostram data,
  horário e formato.
- Sub-etapas existentes podem ser editadas (título, tipo, responsável,
  prazo, horário, link). O formulário de nova etapa voltou a ter tipo e
  responsável (tinham sumido).
- Formatação: as caixas tracejadas grossas ("A fazer") e a faixa por cima do
  conteúdo ("Em andamento") vinham de uma regra de CSS incompleta; cada
  etapa agora é um cartão com borda fina. O "Nº 01" não fica mais por cima
  da data.

**Banco** (aplicado em 19/10, antes do código, só acréscimos):
`supabase/sql/2026-10-19-rodada3-endereco-vocativo-subetapas.sql` — também
no fim do `schema.sql`.

**Capa do login** ✅ (19/10): foto enviada pela Gabriela em
`public/brand/capa-login.jpg` (1600 × 893, 185 KB; veio pelo WhatsApp).
Com a névoa por cima, a resolução basta; se ela mandar o original em alta,
é só trocar o arquivo com o mesmo nome.

**Pendente da Gabriela:** testar o lado do cliente (roteiro, passos 17 a 22).

## Rodada 4 — revisão da Gabriela em 20/10/2026

**Pendências e sino**
- Tarefas e prazos do cliente só viram pendência quando vencem em até 7
  dias ou já venceram (`PRAZO_PROXIMO_DIAS` em `src/lib/pendencias.js`).
  Pedidos explícitos (aprovar etapa, confirmar ou assinar documento, termo,
  orçamento) entram sempre.
- O número do sino conta só o que a pessoa ainda não viu; abrir o sino
  marca como visto (por pessoa e aparelho, no navegador). A lista continua
  mostrando tudo até ser resolvido. A janela ao entrar só aparece quando há
  algo novo.
- Clicar numa pendência leva ao item: troca de aba, ajusta o filtro da
  linha do tempo se precisar, rola até o item e o destaca. Antes, clicar
  numa tarefa estando na própria linha do tempo não fazia nada.

**Linha do tempo e topo do projeto**
- Prazo das sub-etapas numa coluna à direita.
- "Próximo prazo" conta também as sub-etapas e diz qual é; texto menor.

**Documentos**
- O studio edita nome e categoria e troca o arquivo de um documento.
- "Pedir OK" virou "Pedir confirmação do cliente": o cliente vê um bloco
  claro e escolhe **Confirmo** (ou **Assinar**) ou **Pedir ajustes** (com
  mensagem). Ajustes pedidos aparecem para o studio (no documento e no
  sino), com "Ajustei, pedir de novo".
- Nova parte **Envios do cliente**: o studio cria pedidos de arquivo (com
  prazo e instruções) e o cliente manda vários arquivos de uma vez em cada
  pedido, com um recado opcional. O studio confere e conclui. Os pedidos
  são sub-etapas com "Pedir arquivos ao cliente" marcado, então aparecem
  também na linha do tempo. O arquivo que já tinha sido mandado pelo jeito
  antigo foi levado para a lista nova.

**Aprovação de etapa (sem contrato)**
- Em cada etapa, o studio usa "Pedir aprovação do cliente". O cliente vê o
  pedido na etapa e no sino e **aprova** (nome completo + "revisei e
  aprovo"; ficam nome, data e hora) ou **pede ajustes** (mensagem). O studio
  vê o resultado na etapa; ajustes pedidos entram no sino dele.

**Aviso por e-mail**
- Ao pedir confirmação ou assinatura de documento, aprovação de etapa ou um
  envio de arquivos, o studio pode marcar "Avisar o cliente por e-mail"
  (marcado por padrão). Edge Function nova: `avisar-cliente` (só o studio
  chama; usa o vocativo do projeto).

**Calendário**
- O atalho do Google virou "Salvar na minha agenda", com explicação ao
  passar o mouse, e só aparece em reuniões, visitas e eventos.

**Banco** (aplicado em 20/10, antes do código, só acréscimos):
`supabase/sql/2026-10-20-rodada4-aprovacoes-e-envios-do-cliente.sql`,
também no fim do `schema.sql`; políticas de `sub_arquivos` também em
`permissoes-producao.sql`. Testado num banco montado do zero (24 cenários:
dono, outro cliente, studio, pedido aberto e concluído, caminho de arquivo).

**Lição:** o Supabase pede confirmação manual para migrações que apagam
algo (`drop function`, `drop policy`) e, sem resposta, devolve "cancelled".
Foi o que travou a Etapa 8 e a 1ª tentativa desta rodada. Por isso a função
nova se chama `confirmar_documento` e a antiga, `responder_documento`, ficou
no banco (sem uso pelo código novo; pode ser apagada à mão depois).

## Rodada 5 — visão do studio (revisão de 20/10/2026, à tarde)

A visão do cliente vem numa rodada separada, depois desta.

**Topo do projeto**
- Nome do cliente agora é o digitado **neste** projeto (`projects.client_name`).
  Antes vinha do perfil, que guarda o nome do primeiro cadastro daquele
  e-mail; por isso o CASA TESTE mostrava "Lusinalva". Projetos existentes
  receberam o nome do perfil; corrija em "Editar dados do projeto", que
  agora tem o campo "Nome do cliente".
- Ordem: endereço, cliente, datas ("Data de Início" e "Previsão de
  Entrega"). O vocativo não aparece mais no topo do studio.
- O quadro da direita mostra a **fase** (etapa macro) com o próximo prazo e
  "Prazo – data" embaixo; sub-etapas não entram mais nessa conta.
- Textos de exemplo dos formulários ficaram genéricos ("Nome do cliente",
  "Rua e número"…), sem nomes reais.

**Linha do Tempo**
- Sempre abre em "Em andamento" (studio e cliente).
- Saíram o "Nº 01", a linha "Sub-etapas · 0 de 6 concluídas", a etiqueta
  "Etapa" e "Responsável: Studio" das etapas macro.
- Nas sub-etapas, "Tarefa", "Studio" e "Sem prazo" não aparecem (são o
  padrão); o tipo virou texto discreto; as setas, o lápis e o X aparecem ao
  passar o mouse no computador (no iPad continuam visíveis, mais leves).
- A Gabriela ainda acha a lista poluída e vai pensar num formato melhor.

**Documentos**
- Categorias: Atas de Reunião, Entregas de Projeto e Documentos Gerais.
  Briefing e Contrato saíram; o que estava nelas passou para Documentos
  Gerais.
- "Enviar Documento" abre um formulário claro: arquivo, categoria, "Pedir
  aprovação do cliente" e "Notificar cliente via e-mail".
- Pedido ao cliente: só "Sem pedido" ou "Pedir aprovação do cliente"
  (documento antigo que pedia assinatura continua com a opção).

**Contratos e Termos**
- O cartão segue o mesmo padrão das outras partes, com o texto, o motivo
  de recusa e as ações dentro dele. Botão **Editar** (nome, texto, PDF),
  exceto em documento já assinado ou aprovado.
- Projeto novo **não** cria mais o contrato em rascunho; a Gabriela sobe o
  contrato quando o cliente fecha. Os rascunhos que já existem podem ser
  excluídos pela própria tela.

**Títulos** com iniciais maiúsculas: Linha do Tempo, Contratos e Termos,
Etapas do Projeto, Envios do Cliente, Novo Projeto etc.

**Banco** (aplicado em 20/10, antes do código):
`supabase/sql/2026-10-20-rodada5-nome-do-cliente-e-categorias.sql`, também
no fim do `schema.sql`.
