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
