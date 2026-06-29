# Checklist de produção

O que **já está pronto** e o que **falta** para colocar o portal no ar.
Detalhes de cada passo estão em [`DEPLOY.md`](./DEPLOY.md). Caminho escolhido:
**Vercel** (hospedagem do app) + **domínio .com.br** (opcional, por último).

> Enquanto isso, para desenvolver, rode no **modo mock** (`npm run dev`) — não
> precisa de nada deste checklist.

---

## ✅ Já feito (não precisa fazer nada)

Aplicado direto no projeto Supabase `acqagwwjdaoodmnmtpgp`:

- [x] Banco de dados + RLS (13 tabelas, todas com RLS ativo)
- [x] Security advisor sem alertas
- [x] Funções de RLS com `search_path` fixo (hardening)
- [x] Usuário do studio criado (`jprebello10@gmail.com`, papel `studio`)
- [x] Bucket de Storage `documentos` (privado) + policies
- [x] Edge Function `invite-client` deployada (status ACTIVE)
- [x] Código: camada async, code-split e docs (nos commits do patch)

---

## ⏳ Falta fazer (em ordem, quando for pra produção)

### 1. Subir o código pro GitHub
- [ ] Aplicar o patch e dar push:
  ```bash
  git am portal-supabase-full.patch
  git push
  ```

### 2. (frontend) Tela de "criar senha" no 1º acesso do cliente
- [ ] **Decisão de produto pendente.** O cadastro de cliente usa convite por
      e-mail: o cliente clica no link e precisa **definir a senha**. Hoje o app
      só tem tela de login — falta a tela de "criar/definir senha".
      Duas opções:
      - **(a)** criar essa telinha no frontend (chama `supabase.auth.updateUser({ password })`); ou
      - **(b)** trocar a Edge Function para o studio definir uma senha inicial
        e repassar ao cliente (sem e-mail).
      > Dá pra resolver na fase de "caprichar no frontend". Até lá, o login do
      > studio funciona normalmente; só o fluxo de convite de cliente depende disto.

### 3. Publicar o frontend no Vercel
- [ ] Criar conta no [Vercel](https://vercel.com) e conectar o repositório do GitHub.
- [ ] O Vercel detecta o Vite automaticamente (build `npm run build`, saída `dist`).
      Como o app não usa rotas por URL, não precisa de `vercel.json`.
- [ ] Definir as **Environment Variables** no painel do Vercel:
      - `VITE_DATA_SOURCE` = `supabase`
      - `VITE_SUPABASE_URL` = `https://acqagwwjdaoodmnmtpgp.supabase.co`
      - `VITE_SUPABASE_ANON_KEY` = (pegar em Supabase → Project Settings → API → `anon public`)
- [ ] Publicar → anotar a URL gerada (ex.: `portal-gabriela.vercel.app`).

### 4. Configurar as URLs de autenticação no Supabase
- [ ] Supabase → **Authentication → URL Configuration**:
      - **Site URL**: a URL do Vercel (ou o domínio próprio depois).
      - **Redirect URLs**: adicionar `https://<sua-url>.vercel.app/**`.
      (Isto é o que faz o link do convite de cliente voltar pro app.)

### 5. E-mail de verdade (SMTP próprio)
- [ ] Configurar SMTP em **Authentication → Emails** (ex.: Resend, SendGrid).
      O e-mail embutido do Supabase é só pra teste (limite baixo) e não serve
      pra enviar convites pra clientes de verdade.

### 6. (Opcional) Domínio .com.br
- [ ] Comprar no [Registro.br](https://registro.br) (~R$40/ano).
- [ ] No Vercel: **Settings → Domains → Add** e seguir as instruções de DNS.
- [ ] Trocar a Site URL / Redirect URLs (passo 4) pro domínio novo.

### 7. Operação no plano Free (decidir)
- [ ] **Pausa por inatividade:** projetos free pausam após 7 dias sem uso.
      Opções: keep-alive (ping diário) ou plano Pro ($25/mês, sem pausa).
- [ ] **Backups:** o free não tem backup automático. Exportar dumps
      periódicos ou ir pro Pro (backup diário).

---

## Resumo

| Etapa | Status |
|------|--------|
| Backend Supabase (banco, RLS, função, storage, studio) | ✅ pronto |
| Código no GitHub | ⏳ aplicar patch + push |
| Tela de criar senha do cliente | ⏳ frontend (decidir abordagem) |
| Deploy no Vercel + env vars | ⏳ |
| URLs de auth no Supabase | ⏳ |
| SMTP próprio | ⏳ recomendado |
| Domínio .com.br | ⏳ opcional, por último |
| Pausa de 7 dias / backups | ⏳ decidir |
