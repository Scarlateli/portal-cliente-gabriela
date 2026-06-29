# Colocar o Portal em produção

Guia passo a passo para ligar o backend Supabase e publicar o app.

> **Importante:** por padrão o app roda 100% no **mock em memória**
> (`VITE_DATA_SOURCE=mock`). Nada aqui é obrigatório para desenvolver — só
> para rodar com dados reais (Supabase) e/ou publicar online. O modo mock
> continua funcionando sem nenhum desses passos.

---

## Visão geral

São duas frentes independentes:

1. **Backend (Supabase):** banco + RLS, usuário do studio, Edge Function e
   configuração de e-mail/URLs.
2. **Frontend:** build estático (Vite) publicado em qualquer host (Vercel,
   Netlify, Cloudflare Pages…), apontando para o Supabase via variáveis de
   ambiente.

A "chave" que liga tudo é a variável `VITE_DATA_SOURCE`: `mock` (padrão) ou
`supabase`.

---

## Pré-requisitos

- Node.js 20+ e o repositório clonado (`npm install`).
- Uma conta no [Supabase](https://supabase.com) e um projeto criado.
- (Para a Edge Function) a [Supabase CLI](https://supabase.com/docs/guides/cli):
  `npm install -g supabase` e `supabase login`.

---

## Passo 1 — Banco de dados (schema + RLS)

O schema completo (tabelas, RLS, funções e bucket de Storage) está em
[`src/lib/supabase/schema.sql`](../src/lib/supabase/schema.sql).

**Opção A — SQL Editor (mais simples):** abra o projeto no Supabase →
*SQL Editor* → cole o conteúdo de `schema.sql` → *Run*.

**Opção B — CLI (versionado):**

```bash
supabase link --project-ref <SEU_PROJECT_REF>
# coloque o schema.sql dentro de supabase/migrations/ com timestamp, ou:
supabase db push
```

Depois de aplicar, confirme em *Table Editor* que as 13 tabelas existem e que
o cadeado de **RLS está ativo** em todas. Rode também o *Advisor* de segurança
(*Database → Advisors*) — deve ficar sem alertas.

> As funções `is_studio()` e `owns_project()` já vêm com `search_path` fixo
> (hardening recomendado pelo Advisor). Não remova isso.

---

## Passo 2 — Criar o usuário do studio

O app **convida clientes** automaticamente, mas o **primeiro usuário do studio**
(a Gabriela) é criado à mão:

1. Supabase → *Authentication → Users → Add user* → informe e-mail e senha e
   confirme o e-mail (marque "Auto Confirm User" se disponível).
2. Copie o **UUID** do usuário criado.
3. SQL Editor → crie o perfil com papel `studio`:

```sql
insert into public.profiles (id, role, name, email)
values ('<UUID_DO_AUTH_USER>', 'studio', 'Gabriela Lendecker', '<email>');
```

Pronto — esse e-mail/senha entram direto no painel do studio.

> Clientes **não** são criados assim: o studio cadastra um projeto (aba "Novo
> projeto"), e a Edge Function envia um convite por e-mail para o cliente
> definir a própria senha.

---

## Passo 3 — Edge Function `invite-client`

Cria o login do cliente sem expor a `service_role` no front. Código em
[`supabase/functions/invite-client/index.ts`](../supabase/functions/invite-client/index.ts).

```bash
supabase functions deploy invite-client
```

Os segredos `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`
já existem por padrão no ambiente das Functions — não precisa configurá-los.
A função exige JWT válido (só usuários logados conseguem chamar) e valida que
o chamador é do studio.

---

## Passo 4 — Autenticação: URLs e e-mail

### URLs de redirecionamento

Supabase → *Authentication → URL Configuration*:

- **Site URL:** a URL principal do app.
  - Dev local: `http://localhost:5173`
  - Produção: o domínio publicado (ex.: `https://portal.seudominio.com`)
- **Redirect URLs (allow list):** adicione as URLs que o app pode usar no
  retorno de convites/recuperação de senha. Inclua, por exemplo:
  - `http://localhost:5173/**`
  - `https://portal.seudominio.com/**`

O link do convite de cliente leva a pessoa para confirmar e definir a senha e,
em seguida, retorna para a **Site URL**.

### E-mail (SMTP)

O Supabase tem um servidor de e-mail embutido **só para testes**, com limite
baixo (poucos e-mails por hora) — suficiente para você testar com o próprio
e-mail. Para produção (convites de clientes de verdade), configure um SMTP
próprio em *Authentication → Emails → SMTP Settings* (ex.: Resend, SendGrid,
Postmark, Mailgun).

---

## Passo 5 — Variáveis de ambiente

Copie `.env.example` para `.env` (não versionar — já está no `.gitignore`):

```bash
VITE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=https://<SEU_PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<sua_anon_key>
```

Pegue a URL e a **anon key** (pública, protegida por RLS) em
*Project Settings → API*. **Nunca** use a `service_role` no front.

---

## Passo 6 — Publicar o frontend

O app é um SPA estático (Vite). Em qualquer host:

```bash
npm run build      # gera dist/
```

**Vercel / Netlify / Cloudflare Pages:**

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Environment variables:** defina `VITE_DATA_SOURCE`, `VITE_SUPABASE_URL` e
  `VITE_SUPABASE_ANON_KEY` no painel do host (as `VITE_*` entram no build).
- **SPA rewrite:** redirecione tudo para `index.html` (necessário por ser
  single-page). Na Vercel isso é automático; na Netlify, crie um
  `public/_redirects` com:

  ```
  /*  /index.html  200
  ```

Depois de publicar, volte ao **Passo 4** e adicione a URL de produção em
*Site URL* e *Redirect URLs*.

---

## Passo 7 — Virar a chave e testar

1. Garanta `VITE_DATA_SOURCE=supabase` (no `.env` local ou nas env vars do host).
2. Suba o app (`npm run dev` local, ou o deploy de produção).
3. **Smoke test:**
   - Login com o usuário do studio (Passo 2).
   - Crie um projeto de teste na aba "Novo projeto" → o cliente recebe o convite.
   - Aceite o convite em outro navegador, defina a senha e entre como cliente.
   - Confira que o cliente só enxerga o próprio projeto (isolamento por RLS).

Para voltar ao mock a qualquer momento, basta `VITE_DATA_SOURCE=mock` (ou
remover a variável) e rebuildar.

---

## Operação no plano Free do Supabase

- **Custo:** R$ 0. Não pede cartão e permite uso comercial. Você só passa a
  pagar se **fizer upgrade** ou adicionar um cartão e estourar limites.
- **Limites (2026):** 500 MB de banco, 1 GB de Storage, 5 GB de tráfego/mês,
  50.000 usuários ativos/mês, 500 mil invocações de Edge Function/mês. Mais que
  suficiente para um portal de poucos clientes.
- **Pausa por inatividade (o ponto mais importante):** projetos no Free são
  **pausados após 7 dias sem atividade**. Os dados **não** são apagados — você
  reativa com um clique no dashboard, mas o app fica fora do ar até reativar.
  Se for usar em produção de verdade, considere o plano Pro ($25/mês, sem
  pausa e com backup diário) ou um "keep-alive" (um ping diário ao banco).
- **Sem backup automático no Free.** Se os dados importarem, exporte dumps
  periódicos (há guias de backup via GitHub Actions) ou vá de Pro.
- **Alertas:** o Supabase avisa por e-mail ao chegar perto de qualquer limite.

---

## Segurança (checklist)

- [ ] `service_role` **nunca** no front — só na Edge Function (servidor).
- [ ] `.env` fora do versionamento (já no `.gitignore`).
- [ ] RLS ativo em todas as tabelas; *Advisor* de segurança sem alertas.
- [ ] Apenas a **anon key** no app.
- [ ] Usuário do studio criado com papel `studio`; clientes via convite.

---

## Resumo rápido

| Passo | Onde | Obrigatório p/ produção |
|------|------|------|
| Schema + RLS | SQL Editor / CLI | ✅ |
| Usuário studio | Auth + SQL | ✅ |
| Edge Function | `supabase functions deploy` | ✅ (cadastro de cliente) |
| URLs de auth | Auth → URL Configuration | ✅ |
| SMTP próprio | Auth → Emails | Recomendado |
| `.env` (supabase) | host / local | ✅ |
| Build + host | Vercel/Netlify/CF | ✅ |
| Flip `VITE_DATA_SOURCE` | env | ✅ |
