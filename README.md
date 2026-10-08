# Portal do Projeto — Gabriela Lendecker

Portal em que o studio Gabriela Lendecker (arquitetura e interiores) acompanha
cada projeto junto com o cliente. Em produção em
**[portal.gabrielalendecker.com](https://portal.gabrielalendecker.com)**.

## O que faz

**Para o studio**
- Cadastra projetos e convida o cliente (senha provisória por e-mail; troca
  obrigatória no primeiro acesso). Edita os dados do projeto e pode excluí-lo.
- Monta a linha do tempo com etapas e sub-etapas, a partir de templates
  (editáveis, com sub-etapas) ajustados já no cadastro.
- Publica documentos pedindo ao cliente só um OK ou uma assinatura.
- Contratos e termos: termo aprovado ou recusado com um botão; contrato
  assinado dentro do portal ou pela Autentique (validade jurídica).
- Orçamentos com fornecedores do cadastro do studio; o cliente pode aprovar,
  reprovar ou pedir negociação.
- Pagamentos, calendário (com atalho para o Google Agenda), histórico em PDF.

**Para o cliente**
- Vê só os projetos dele: etapas, calendário, documentos, contratos,
  pagamentos, orçamentos e fornecedores.
- Responde ao que o studio pede (OK, assinatura, aprovação de termo, decisão
  de orçamento) e envia arquivos nas sub-etapas sob responsabilidade dele.

**Para os dois:** sino de pendências no topo de todas as telas e uma janela
ao entrar enquanto houver algo esperando uma ação.

## Stack

React 19 + Vite · TanStack Query · Supabase (Postgres com RLS, Auth, Storage,
Edge Functions) · Vercel · Zod · Vitest + Testing Library · ESLint + Prettier.

## Rodando localmente

Requisito: Node 20+.

```bash
npm install
cp .env.example .env   # escolha o modo em VITE_DATA_SOURCE
npm run dev            # http://localhost:5173
```

Há dois modos, escolhidos por `VITE_DATA_SOURCE`:

- **`mock` (demonstração):** dados em memória, não persistem. Acessos de teste:
  studio `studio@demo.com` / `1234`; clientes `cliente@demo.com` e
  `cliente2@demo.com` / `1234`.
- **`supabase` (produção):** precisa de `VITE_SUPABASE_URL` e
  `VITE_SUPABASE_ANON_KEY`. Nunca use a `service_role` no front-end.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | ambiente de desenvolvimento |
| `npm run build` | build de produção em `dist/` |
| `npm run preview` | serve o build localmente |
| `npm test` / `npm run test:watch` | testes (Vitest) |
| `npm run lint` | ESLint + Prettier |
| `npm run format` | formata o código |

Antes de cada commit de código: testes verdes, lint limpo e build nos dois
modos (ver [AGENTS.md](AGENTS.md)).

## Estrutura

```
src/
  App.jsx                 login, roteamento studio/cliente, contexto do sino
  components/
    admin/                painel do studio, novo projeto, templates, fornecedores
    project/              abas do projeto (linha do tempo, calendário, documentos,
                          contratos, pagamentos, orçamentos, fornecedores)
    Pendencias.jsx        sino e janela de pendências
  lib/
    db.js                 banco de demonstração (síncrono) — especificação de referência
    supabase/db-supabase.js  mesmo contrato, assíncrono, contra o Supabase
    supabase/schema.sql   banco completo (tabelas, funções, RLS) — monta a produção do zero
    useResolvedDb.js, data.js  fachada de dados, cache e invalidações
    pendencias.js         regra do que é pendência (studio e cliente)
  styles/theme.css        identidade visual (paleta oficial, Futura Std)
supabase/
  functions/              Edge Functions (convite, senha, Autentique)
  sql/                    histórico das mudanças de banco, na ordem em que entraram
docs/                     deploy, status e pendências, roteiro de validação
```

## Banco de dados

- `src/lib/supabase/schema.sql` é a fonte da verdade e reproduz a produção
  (conferido em 07/10/2026 contra o banco real: tabelas, colunas, regras,
  políticas e funções).
- Cada mudança entra também como arquivo datado em `supabase/sql/`, para
  aplicar num banco que já existe.
- O cliente nunca altera contratos, termos, documentos ou orçamentos
  diretamente: responde pelas funções `responder_documento`,
  `responder_contrato` e `decidir_orcamento`, que conferem a posse e mexem só
  no campo da ação.

## Edge Functions

| Função | Para quê |
|---|---|
| `invite-client` | cria o acesso do cliente e envia o convite |
| `forgot-password` | e-mail de redefinição de senha (sem login) |
| `autentique-send` | envia o contrato para assinatura na Autentique |
| `autentique-check` | consulta o status da assinatura |
| `autentique-webhook` | recebe avisos da Autentique (redundância) |

## Documentação

- [docs/DEPLOY.md](docs/DEPLOY.md) — colocar em produção
- [docs/STATUS-E-PENDENCIAS.md](docs/STATUS-E-PENDENCIAS.md) — o que existe, o que falta
- [docs/ROTEIRO-VALIDACAO-GABRIELA.md](docs/ROTEIRO-VALIDACAO-GABRIELA.md) — roteiro de teste
- [docs/PLANO-PRODUCAO.md](docs/PLANO-PRODUCAO.md) — plano de produção
- [AGENTS.md](AGENTS.md) — regras para quem mexe no código
