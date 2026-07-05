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

### 2. ✅ Primeiro acesso do cliente — resolvido
- [x] Tela de **criar senha** implementada — usada na troca obrigatória do
      1º login (e também por links de recuperação de senha).
- [x] Acesso por **senha provisória**: ao criar o projeto, o studio vê
      e-mail + senha do cliente na tela (e sai por e-mail com o Resend ativo).
      Troca de senha **obrigatória** no 1º login. Roteiro do teste em
      [`TESTE-PRE-GOLIVE.md`](./TESTE-PRE-GOLIVE.md).

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

### 5. E-mail automático do convite (Resend)
- [ ] O envio **já está implementado** na função `invite-client` — falta só a
      chave: criar conta no [Resend](https://resend.com) → *API Keys* → copiar
      → Supabase Dashboard → **Edge Functions → invite-client → Secrets** →
      adicionar `RESEND_API_KEY`.
- [ ] Sem domínio verificado no Resend, o envio só chega **no e-mail do dono
      da conta Resend** (suficiente para o teste). Para clientes reais:
      verificar um domínio (ex.: o `.com.br` do passo 7) e adicionar o secret
      `INVITE_FROM` (ex.: `Gabriela Lendecker <portal@gabrielalendecker.com>`).
      O **link copiável continua funcionando** em qualquer cenário.

### 6. Assinatura digital (Autentique)
- [ ] Criar conta na [Autentique](https://www.autentique.com.br) e gerar um
      **token de API** (painel → API keys). Com o token em mãos, a integração
      real entra por Edge Function (envio do documento + webhook de status) —
      me avise quando tiver o token.

### 7. Domínio — gabrielalendecker.com (GoDaddy)
- [ ] **Resend (libera e-mail p/ qualquer cliente)**: Resend → *Domains* →
      Add `gabrielalendecker.com` → copiar os registros (DKIM/SPF) → colar no
      **DNS do GoDaddy** → aguardar *Verified*. Depois, adicionar o secret
      `INVITE_FROM` na função (ex.: `Gabriela Lendecker <portal@gabrielalendecker.com>`).
- [ ] **Portal**: no Vercel, *Settings → Domains* → `portal.gabrielalendecker.com`
      → criar no GoDaddy o CNAME indicado.
- [ ] **Site** (repo separado — ver [`BRIEFING-SITE.md`](./BRIEFING-SITE.md)):
      domínio raiz `gabrielalendecker.com` no projeto do site na Vercel
      (registros A/CNAME indicados). O botão "Portal do Cliente" do site
      aponta para o subdomínio.
- [ ] **Supabase Auth**: adicionar `https://portal.gabrielalendecker.com` na
      Site URL e `https://portal.gabrielalendecker.com/**` nas Redirect URLs
      (mantendo o localhost para dev).

### 8. Operação no plano Free (decidir)
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
| Primeiro acesso do cliente (link + criar senha) | ✅ pronto |
| Deploy no Vercel + env vars | ⏳ |
| URLs de auth no Supabase | ⏳ |
| SMTP (e-mail automático) | ⏳ opcional |
| Integração Autentique | ⏳ precisa do token |
| Domínio gabrielalendecker.com (Resend + portal + site) | ⏳ DNS no GoDaddy |
| Pausa de 7 dias / backups | ⏳ decidir |
