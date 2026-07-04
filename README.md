# Portal do Cliente — Gabriela Lendecker

Portal para o studio acompanhar projetos de arquitetura de interiores junto aos clientes:
linha do tempo, calendário, documentos, contrato/assinatura, pagamentos, orçamentos e
fornecedores. Inclui geração de **histórico em PDF**.

> Estágio atual: **protótipo navegável** com dados mock em memória (não persistem entre
> sessões). A estrutura já está preparada para plugar o Supabase — ver
> [Backend](#backend-supabase) e [O que falta para produção](#o-que-falta-para-produção).

## Stack
- **React 18 + Vite** (build e dev server)
- **lucide-react** (ícones)
- **Zod** (validação de formulários)
- **Vitest + Testing Library** (testes)
- **ESLint + Prettier** (qualidade de código)

## Rodando localmente
Requisitos: Node 18+ (recomendado 20+).

```bash
npm install
npm run dev
```

Abra **http://localhost:5173**.

### Acessos de teste
- Studio: `studio@demo.com` / `1234`
- Cliente: `cliente@demo.com` / `1234`
- Cliente: `cliente2@demo.com` / `1234`

## Scripts
- `npm run dev` — ambiente de desenvolvimento (localhost)
- `npm run build` — build de produção (gera `dist/`)
- `npm run preview` — serve o build de produção localmente
- `npm test` — roda os testes (Vitest)
- `npm run lint` — checagem de lint
- `npm run format` — formata o código com Prettier

## Estrutura
```
src/
  lib/            # constantes, helpers, dados mock (seed), camada de dados (db) e validação
    supabase/     # cliente, schema.sql e esqueleto do data layer (futuro backend)
  components/     # UI: átomos, login, área admin e abas do projeto
  styles/theme.css# tema (BRAND TOKENS: cores e fontes em um só lugar)
public/
  fonts/          # Futura Std (.otf)
  logo.svg        # logo (placeholder — ver abaixo)
```

## Marca (cores, fonte e logo)
- **Cores e fontes**: tudo em `src/styles/theme.css`, no bloco `BRAND TOKENS`.
  Paleta: off-white `#d8d4ca`, bege `#ab9b83`, vermelho `#5d1c17`, terra `#704538`,
  marrom `#44261e`, vinho `#391312`, dark `#210909`.
- **Fonte**: **Futura Std** (arquivo em `public/fonts/FuturaStd-Book.otf`), com **Jost**
  como fallback. Só a variante *Book* foi fornecida; pesos mais fortes são sintetizados
  pelo navegador. Para refinar, adicione as variantes (ex.: *Medium*, *Bold*) e novos
  blocos `@font-face`.
- **Logo**: `public/logo.svg` é um **placeholder** (monograma). Para usar o logo real,
  substitua esse arquivo (`.svg` ou `.png`); se mudar a extensão, ajuste `LOGO` em
  `src/lib/constants.js`. O logo do protótipo original pode ser reaproveitado a partir do
  código antigo (estava embutido em base64).

## Backend (Supabase)
O app roda por padrão no **mock** (`src/lib/db.js`). O backend Supabase já está
**implementado** — basta ligar a chave `VITE_DATA_SOURCE=supabase`:

1. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY` (chave **anon**; nunca a service_role no front) e
   `VITE_DATA_SOURCE=supabase`.
2. Rode `src/lib/supabase/schema.sql` no SQL Editor (tabelas + RLS + Storage).
3. Faça deploy da Edge Function: `supabase functions deploy invite-client`.

A camada `src/lib/supabase/db-supabase.js` é o espelho assíncrono completo do
mock; o React Query (só no modo supabase) é carregado sob demanda. Em modo mock
nada do Supabase entra no bundle. Passo a passo completo em
[`docs/DEPLOY.md`](docs/DEPLOY.md).

## Deploy (Vercel)
Resumo: importe o repo em [vercel.com](https://vercel.com) (framework Vite
detectado, build `npm run build`, output `dist`), configure as variáveis
`VITE_*` e publique. Detalhes e domínio próprio em
[`docs/DEPLOY.md`](docs/DEPLOY.md).

## O que falta para produção
Checklist completo (com o que já está pronto e o que falta) em
[`docs/CHECKLIST-PRODUCAO.md`](docs/CHECKLIST-PRODUCAO.md). Em resumo, ainda
faltam: deploy no Vercel + variáveis de ambiente, URLs de auth no Supabase e,
opcionais, domínio `.com.br` e SMTP para e-mails automáticos (o convite do
cliente é por link copiável). Outras melhorias de produto:

- **Assinatura de contrato** real via **Autentique** (API GraphQL + webhook) — falta criar a conta e o token.
- **E-mails automáticos** (atraso de etapa, lembrete de parcela) via Resend/SendGrid.
- **Pagamento online** (opcional): Asaas/Stripe/Mercado Pago (PIX/boleto).
- **LGPD**: política de privacidade, consentimento e backups.
- **Licenciar a Futura Std** para uso em produção web.

---
© Gabriela Lendecker · arquitetura de interiores
