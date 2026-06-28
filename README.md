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
O app roda hoje 100% no mock (`src/lib/db.js`). Para o backend real:
1. Crie um projeto no [Supabase](https://supabase.com).
2. Rode `src/lib/supabase/schema.sql` no SQL Editor (cria tabelas + RLS).
3. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY` (use a chave **anon**; nunca a service_role no front).
4. Implemente os métodos em `src/lib/supabase/db-supabase.js` (espelho assíncrono do mock)
   e adapte os componentes para `async/await` + estados de carregamento.

## Deploy (Vercel)
1. Suba o repositório no GitHub (já configurado).
2. Em [vercel.com](https://vercel.com), **Add New → Project** e importe o repo.
3. Framework: **Vite** (detectado). Build: `npm run build`. Output: `dist`.
4. Configure as variáveis de ambiente (quando houver backend).
5. Deploy. Depois, conecte um domínio próprio (HTTPS é automático).

## O que falta para produção
- **Backend real** (Supabase): Auth (sem senha em texto puro), RLS (cliente só vê o
  próprio projeto) e Storage para os PDFs.
- **Assinatura de contrato** real (ZapSign/Autentique/Clicksign/D4Sign) via API + webhook.
- **E-mails automáticos** (atraso de etapa, lembrete de parcela) via Resend/SendGrid.
- **Pagamento online** (opcional): Asaas/Stripe/Mercado Pago (PIX/boleto).
- **LGPD**: política de privacidade, consentimento e backups.
- **Remover usuários de demonstração** (seed) antes de publicar.
- **Licenciar a Futura Std** para uso em produção web.

---
© Gabriela Lendecker · arquitetura de interiores
