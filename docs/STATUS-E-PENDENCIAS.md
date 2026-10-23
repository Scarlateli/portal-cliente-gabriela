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

## Rodada 6 — visão do cliente (revisão de 20/10/2026, à noite)

**Janela de pendências**: o título agora é só "Você tem N pendências".

**Lista de sub-etapas no desenho da Gabriela** (vale para cliente e studio)
- Cada sub-etapa tem uma bolinha numa linha pontilhada. A primeira ainda
  aberta fica destacada; as concluídas ficam preenchidas.
- O cliente não tem mais caixinha para marcar. O studio conclui clicando na
  bolinha.
- O nome fica em destaque. Embaixo vêm o tipo (em caixa) e uma descrição
  curta, que agora toda sub-etapa pode ter (campo "Descrição curta" no
  formulário; num pedido de arquivos, é o que o cliente deve mandar).
- Tarefa do cliente: "Essa é uma tarefa sua" em vermelho (no studio,
  "Tarefa do cliente").
- À direita ficam a data ("Hoje", "Amanhã", "Até 30/10", "Venceu 10/06") e,
  em reunião, o horário. Embaixo vem a ação: "Fazer upload" / "Concluir
  entrega" para o cliente, ou "Entrar na reunião". No celular, isso desce
  para baixo da descrição.
- As datas da etapa ficam em duas linhas: "Data de Início – …" e "Previsão
  de Entrega – …".

**Concluir entrega (Envios do Cliente)**
- Depois de mandar os arquivos, o cliente clica em "Concluir entrega" e
  confirma. A partir daí não manda, não tira arquivos e não muda o recado.
- O studio recebe a pendência "Entrega do cliente para conferir". Antes ela
  aparecia a qualquer arquivo enviado. O studio pode **concluir o pedido**
  ou **devolver ao cliente** (que reabre o envio).
- Pendência do cliente: "Enviar arquivos" sem nenhum arquivo, ou "Concluir
  entrega" quando já mandou algo e ainda não concluiu (com prazo perto, como
  antes).

**Segurança**: o cliente podia, pela API, mudar qualquer campo das
sub-etapas dele (marcar como feita, trocar prazo). Agora um gatilho no banco
só deixa o cliente mudar o recado, e só enquanto o pedido está aberto. A
entrega concluída é gravada por uma função do banco (`concluir_entrega`), e
duas políticas restritivas bloqueiam arquivos depois da entrega.

**Datas**: "hoje" passa a ser a data local. Antes, depois das 21h, o portal
já contava o dia seguinte.

**Banco** (aplicado em 20/10, antes do código):
`supabase/sql/2026-10-20-rodada6-concluir-entrega.sql`, também no fim do
`schema.sql`. Foram testados 15 cenários num banco local.

## Rodada 7 — visão do studio (revisão de 22/10/2026)

A visão do cliente vem numa rodada separada, depois desta.

**Cores e topo**
- Fundo #ECE9E3; cartões e barra do topo #FBFAF8. A barra do topo ficou
  mais fina (62px).
- Texto em #210909. O texto secundário (datas, dicas) usa a mesma cor, um
  pouco mais clara, para manter a hierarquia. Vermelho de atraso e verde de
  concluído continuam como sinais.
- Cartão de projeto: cliente e endereço um pouco menores.
- Topo do projeto: o nome da fase usa a mesma fonte do "0/5".

**Linha do Tempo**
- Datas da etapa: ícone de calendário e "Prazos Previstos", com "Início –"
  e "Entrega –" embaixo. Em reunião, "Data Prevista".
- Status da etapa, título, nome e tipo das sub-etapas ficaram um pouco
  menores.
- Tarefa do cliente no studio: sai a etiqueta "Tarefa do cliente". O tipo
  vira "Tarefa – Cliente", na cor do botão "Em andamento". A visão do
  cliente continua com "Essa é uma tarefa sua".
- "N arquivos enviados" desceu para uma linha própria.
- Datas à direita, todas na mesma fonte: concluída não mostra texto;
  vencida mostra "Vencido" e, embaixo, pequena, a data prevista.
- Setas, lápis e X aparecem só com o mouse em cima. Antes, depois de um
  clique, ficavam presos na tela.

**Envios do Cliente**
- A lista mostra os primeiros 6 arquivos, em colunas, com "Ver todos os N
  arquivos".
- "Baixar todos (.zip)" junta os arquivos do pedido num .zip, montado no
  navegador.

**Contratos e Termos**
- "Baixar comprovante (PDF)" em termo aprovado ou contrato assinado pelo
  portal. Fora disso, o botão não aparece: na Autentique, o comprovante é o
  certificado dela.
- O PDF traz o logo, o documento, o projeto, o endereço, o cliente, o texto
  do termo e a declaração "Aprovado por … em dd/mm/aaaa, às hh:mm (horário
  de Brasília), por meio do Portal do Cliente…". No rodapé, o código do
  documento no portal.
- O PDF é gerado no navegador (biblioteca pdf-lib, carregada só no clique).

Sem mudança no banco nesta rodada.

## Rodada 8 — visão do cliente (revisão de 22/10/2026)

- **Topo do projeto:** o cliente não vê mais o código do projeto (só o
  studio vê).
- **Documentos:**
  - Ao aprovar (ou assinar) uma ata ou outro documento, o cliente tem um
    campo "Comentário (opcional)".
  - Se o cliente escreve e clica em "Pedir ajustes", o mesmo texto vira o
    pedido de ajustes, que continua obrigatório.
  - O comentário aparece para o studio e para o cliente embaixo de
    "Aprovado por …".
- **Envios do Cliente:**
  - Texto novo de abertura: "Aqui ficam todos os arquivos que solicitamos a
    você…".
  - "O studio já conferiu este pedido." virou o balãozinho verde "Envio
    validado pelo studio.".

**Banco** (aplicado em 22/10, antes do código):
`supabase/sql/2026-10-22-rodada8-comentario-na-aprovacao.sql`, também no fim
do `schema.sql`. A função `confirmar_documento` mantém os mesmos parâmetros;
agora grava o comentário também na aprovação. Foram testados 7 cenários num
banco local.

## Rodada 9 — revisão geral (22/10/2026)

Conferência na tela renderizada, item por item, das rodadas 5 a 8.

**O que estava incompleto: a cor do texto.** O texto principal já estava em
#210909, mas:
- o secundário (endereços, datas, legendas, abas, "/5") estava numa versão
  70% mais clara da mesma cor;
- uns 70 textos usavam o vinho, o terra ou o vermelho escuro da marca (links,
  títulos de segmento, "Aprovado por…", "Responsável: Cliente",
  "Aguardando…").

Agora todo texto comum é #210909. Sobre os 470 textos medidos nas telas do
studio, só têm outra cor:
- vermelho de atraso e erro;
- verde de pago e aprovado;
- laranja de em andamento ou em produção;
- os botões de excluir;
- o texto claro dentro dos botões escuros.

No topo do projeto, quando a fase está atrasada, o nome fica em #210909 e só
"Prazo vencido – …" fica em vermelho.

**Conferido e certo** (rodada 7):
- fundo #ECE9E3, cartões e topo #FBFAF8;
- topo com 62px;
- fase com a mesma fonte do "0/5" (Futura Light, 20px);
- "Prazos Previstos";
- "Tipo – Cliente" na cor do botão "Em andamento";
- datas na mesma fonte;
- concluída sem texto;
- "Vencido" com a data embaixo;
- arquivos numa linha própria;
- barra de edição só com o mouse em cima, inclusive depois de um clique.

Sem mudança no banco.

## Rodada 10 — melhorias de design (22/10/2026)

Sugestões do Claude aprovadas pelo JP, para a Gabriela validar. Vai um
commit por grupo, para dá para desfazer só a parte que ela não gostar (ver
"Como voltar atrás" no fim).

**0. Correção:** envio de arquivo com acento no nome. O "Contrato de
Serviço_….pdf" falhou em 22/10 porque o armazenamento recusa acentos. Contrato
novo, troca do PDF, orçamento e o anexo antigo de sub-etapa agora limpam o
nome antes de subir; o nome exibido continua o original.

**1. Sistema visual**
- Tipografia em seis tamanhos (12 · 14 · 16 · 20 · 28 · 44): texto corrido
  em 16px, interface em 14px. Antes eram uns 20 tamanhos soltos.
- Cantos de 6px em tudo.
- Etiquetas sem borda; documentos, parcelas, orçamentos, envios e contratos
  são separados por fundo, não por moldura.
- Em telas de toque (iPad, celular), botões e links com pelo menos 44px.

**2. Cliente**
- **Seu próximo passo:** cartão fixo com a ação principal ("Resolver") e
  até 3 outras, mais "ver mais". Sem pendências, mostra "Tudo em dia". A
  janela que abria por cima ao entrar saiu (para cliente e studio); o sino
  continua.
- **Fases do projeto:** linha no topo com a fase atual marcada; no celular,
  rola de lado e começa na atual.
- **Atraso do studio não assusta o cliente:** ele vê "Nova data em
  definição", em tom neutro (na etapa e no topo), e a sub-etapa do studio
  vencida não aparece como "Vencido". O atraso que é do cliente continua em
  vermelho.
- **Linha do Tempo do cliente sem filtros:** todas as etapas, só a atual
  aberta; as outras abrem ao tocar.

**3. Studio**
- **Aba "Hoje"**, onde o painel abre. Junta, de todos os projetos:
  - o que espera pela Gabriela;
  - os atrasados;
  - os próximos 7 dias (reuniões, com "Entrar" nas online; visitas; prazos;
    eventos).

  Cada item leva ao lugar certo do projeto.
- **Etapa:** o status virou um seletor no próprio balão; "Editar etapa" e
  "Excluir etapa" foram para o menu "⋯". Sai a fileira de botões embaixo de
  cada etapa.

**4. "Desfazer" e avisos**
- Excluir sub-etapa, etapa, documento, contrato ou termo, arquivo enviado
  ou orçamento: o item some na hora e aparece "… excluído · Desfazer" por
  6 s. Só depois disso a exclusão vai para o banco.
- Continuam pedindo confirmação: excluir ou finalizar projeto, reenviar
  acesso e envio para a Autentique.
- Aviso de sucesso nas ações principais: documento enviado, arquivos
  enviados, entrega concluída, aprovação, ajustes, dados salvos etc.

**5. Documentos e envios**
- **Visualizador:** PDF e foto abrem dentro do portal, com "Abrir em nova
  aba" e "Baixar". Para o cliente, "Aprovar / Pedir ajustes" fica ao lado
  do documento.
- **Envio arrastando:** área "Arraste os arquivos aqui" ou "Escolher
  arquivos". Os arquivos sobem um a um, com a situação de cada um, e as
  fotos enviadas ganham miniatura.
- **Segurança (CSP):** ganhou `frame-src 'self' blob:` para mostrar o PDF.

**6. Celular, carregamento, telas vazias**
- No celular, barra fixa embaixo: Início, Documentos, Agenda e Mais, com
  o número de pendências de cada parte.
- Enquanto carrega, aparece o desenho da tela em tons claros.
- Telas vazias explicam o que vai aparecer ali.

**Banco:** sem mudança nesta rodada.

### Como voltar atrás (se a Gabriela não gostar de algo)
Cada grupo é um commit. No repositório:
```bash
git log --oneline -12        # acha o commit pelo título
git revert <código-do-commit>
git push
```
Títulos:
- "Sistema visual: escala de tipografia…" (item 1)
- "Cliente: próximo passo, fases…" (2)
- "Studio: tela Hoje e menu ⋯…" (3)
- "Desfazer no lugar de Tem certeza?…" (4)
- "Visualizador de documentos e envio arrastando…" (5)
- "Celular: navegação embaixo…" (6)
- "Toques de 44px no iPad…" (ajuste do 1)

Commits mais antigos podem conflitar com os que vieram depois; nesse caso,
é mais fácil pedir ao Claude.

## Rodada 11 — validação da Gabriela (22/10/2026, à tarde)

**Cores**
- Os fundos não batiam com os códigos: a textura de papel por cima do fundo
  fazia o #ECE9E3 aparecer como #E8E7E2 (medido no print dela). A textura
  saiu. Agora a tela renderizada mede exatamente #ECE9E3 (fundo) e #FBFAF8
  (cartões).
- A cor do texto volta a ser a de antes da rodada 9: principal em #210909,
  secundário na mesma cor mais clara e o vinho da marca onde era vinho.
- Documentos, parcelas, orçamentos, envios e contratos voltam a ser cartões
  com contorno fino. A rodada 10 tinha trocado por um fundo #F5F3EF, que não
  é da paleta.
- Envios: os arquivos ficam numa lista única e compacta, uma linha por
  arquivo.

**O que um mudava e o outro não via**
- Uma tela aberta nunca buscava dados de novo. Por isso a aprovação da
  cliente não aparecia para a Gabriela até recarregar a página, e
  vice-versa.
- Agora o portal busca de novo ao voltar para a aba, a cada 45 s com a aba
  visível e ao reconectar.
- Os dados no banco estavam certos o tempo todo.

**Termo automático ao aprovar etapa**
- O cliente aprova a etapa na Linha do Tempo e nasce na hora o "Termo de
  Aprovação – <etapa>" em Contratos e Termos, já aprovado, com nome, data,
  hora e comentário.
- O comprovante em PDF diz que a aprovação foi feita na Linha do Tempo, com
  nome completo.
- O studio pode editar e excluir esse termo; os outros termos continuam
  sendo criados à mão.
- A etapa BRIEFING do CASA TESTE, aprovada antes desta rodada, já ganhou o
  termo dela.

**Linha do Tempo**
- Topo da etapa em duas colunas (título e status / prazos e ⋯).
- INÍCIO e ENTREGA em caixa alta, sem aumentar.
- Voltam os tamanhos que ela tinha pedido e que a escala da rodada 10 tinha
  aumentado.
- Setas, lápis e X controlados pelo app: aparecem com o mouse em cima e
  somem ao sair ou depois do clique (no Safari ficavam presos).

**Em espera, por decisão dela:**
- o quadro "Aguardando a aprovação do cliente";
- ajustes nas fases do projeto.

**Banco** (aplicado em 22/10, antes do código):
`supabase/sql/2026-10-22-rodada11-termo-da-etapa.sql` (coluna
`contracts.stage_id`; `responder_etapa` passa a criar o termo). Também está
no fim do `schema.sql`; foram testados 7 cenários num banco local.

## Rodada 12 — feedback da Gabriela (23/10/2026)

**Projeto sem e-mail, acesso liberado depois**
- O e-mail do cliente é opcional ao criar o projeto. Dá para lançar tudo
  (etapas, documentos, prazos) e só depois liberar o acesso.
- No projeto, o botão "Liberar acesso ao cliente" pede o e-mail e envia o
  convite. No painel, o cartão do projeto mostra "acesso não liberado".
- Os dados do projeto continuam editáveis depois de lançado ("Editar dados
  do projeto", embaixo da Linha do Tempo).

**Linha do Tempo igual para studio e cliente**
- Abas "Em andamento" e "Todas" nas duas visões.
- Datas da etapa menores, com símbolos: ▷ início, ⚑ entrega, relógio para
  reunião.
- Setas, lápis e X da sub-etapa: só com o mouse em cima daquela linha.
- Etiqueta "Tarefa – Cliente" também para o cliente (sai o "Essa é uma
  tarefa sua"). Data e ação à direita mais discretas.
- Tarefa do cliente criada direto no projeto já vem com "Pedir arquivos".
  Tarefa do cliente sem arquivos ganha "Marcar como feita" (antes virava
  pendência sem ter o que fazer).
- Checkbox "Pedir arquivos" no tamanho certo.

**Cliente**
- A janela com as pendências volta a abrir ao entrar (uma vez por acesso).
- "Seu próximo passo" é uma faixa baixa, vinho, só com o título e o botão.
  Sai o "Tudo em dia".

**Envios**
- Arquivos enviados numa pasta fechada, que abre ao tocar.
- Observação do cliente em cada arquivo (o studio lê).
- Recado para o studio num campo sempre visível.

**Templates**
- Descrição em cada etapa e em cada sub-etapa; vai para a Linha do Tempo ao
  aplicar o template. Sub-etapa do cliente já marca "Pedir arquivos".

**Textos**
- Voltam os tamanhos menores e a cor suave das explicações, como antes da
  rodada 10. Os tamanhos pedidos na rodada 11 continuam.

**Cores**
- Medido de novo: o portal desenha #ECE9E3 e #FBFAF8 exatos. O print do Mac
  sai em outro espaço de cor (Display P3), por isso o conta-gotas lê
  #EAE9E4 no print. É a mesma cor. Pendente: saber com o que ela compara.

**Banco** (aplicado em 23/10, antes do código):
`supabase/sql/2026-10-23-rodada12-projeto-sem-email-e-tarefas.sql`
(`projects.client_id` opcional, `sub_arquivos.nota`, RPCs `anotar_arquivo` e
`concluir_tarefa`). Também está no fim do `schema.sql`.

## Rodada 13 — Linha do Tempo mais leve (23/10/2026)

Pedido da Gabriela: o "Vencido" vermelho ficava solto à direita, as caixas
grossas e as letras em tamanhos desencontrados.
- O prazo da sub-etapa saiu da coluna da direita e vai na linha do tipo,
  colado ao título: "TAREFA – CLIENTE · ⚠ Venceu em 10/06 · Fazer upload".
  A descrição vem logo embaixo.
- Atraso da etapa sem caixa vermelha: uma linha de texto; o studio reagenda
  na mesma linha.
- Contorno de 1px em todas as etapas (sai a borda grossa da etapa em
  andamento e o contorno vermelho da atrasada).
- Uma escala só: título da etapa 17 · sub-etapa 14,5 · texto 13 ·
  detalhes 12 · etiquetas 10–11.
- Tipo e responsável da etapa como texto simples ("Documentação ·
  Responsável: Cliente"); só o status e o "Em atraso" ficam em balão.
- O prazo da sub-etapa é só texto, sem ícone. "⋯" no canto, sem linha vazia.
- A descrição da etapa continua no lugar de antes (depois das sub-etapas).
