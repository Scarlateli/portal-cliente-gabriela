# Teste pré-go-live — roteiro

Objetivo: usar o portal **de verdade** contra o Supabase — **Gabriela como
arquiteta (studio)** e **JP como cliente** — antes de publicar.

## Preparação (uma vez, ~10 min)

1. **Código no lugar** — na pasta do projeto:
   ```bash
   git am portal-supabase-full.patch   # se ainda não aplicou
   npm install
   ```
2. **`.env` apontando pro Supabase** — crie/edite o arquivo `.env` na raiz:
   ```env
   VITE_DATA_SOURCE=supabase
   VITE_SUPABASE_URL=https://acqagwwjdaoodmnmtpgp.supabase.co
   VITE_SUPABASE_ANON_KEY=<Dashboard → Project Settings → API Keys → anon public>
   ```
3. **URLs de autenticação** (necessário pro link de convite voltar pro app):
   Dashboard → **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:5173`
   - **Redirect URLs**: adicionar `http://localhost:5173/**`
4. Rodar: `npm run dev` → abrir `http://localhost:5173`.

> Para voltar ao dia a dia de dev, basta trocar `VITE_DATA_SOURCE` para `mock`.

## Credenciais

- **Studio (Gabriela)**: `jprebello10@gmail.com` — a senha é a que você já
  definiu (existe uma no banco). Se não lembrar: Dashboard → **Authentication →
  Users** → usuário → **⋯ → Reset password** (ou me peça que eu redefino).
- **Cliente (JP)**: criado durante o teste, via link de convite (passo abaixo).
  Use um e-mail seu diferente do do studio.

## Roteiro — Gabriela (studio)

1. Login com o e-mail do studio.
2. **Novo projeto**: preencher dados + nome e e-mail do JP → **Criar projeto**.
3. Vai aparecer a caixa **“Link de acesso do cliente”** → **Copiar link** →
   enviar pro JP (WhatsApp/e-mail).
4. Abrir o projeto e montar o cenário:
   - Aplicar um **template de etapas** (ou criar etapas manuais — crie uma com
     prazo no passado para ver o estado **Em atraso**).
   - Criar uma **Reunião** online (com link) e uma presencial.
   - **Documentos**: subir um PDF.
   - **Contratos e termos**: adicionar um termo, **enviar para assinatura**.
   - **Pagamentos**: criar plano (teste um vencimento dia 29–31).
   - **Orçamentos**: adicionar um orçamento com valor.

## Roteiro — JP (cliente)

> ⚠️ Abra o link **em janela anônima ou outro navegador** — se abrir no mesmo
> navegador da Gabriela, a sessão dela é substituída pela do cliente.

1. Abrir o link recebido → tela **“Crie sua senha”** → definir senha (mín. 8).
2. Entra direto no projeto. Conferir:
   - **Linha do tempo**: descrições sob os títulos, tag de responsabilidade só
     quando for do cliente, status por último (laranja = em andamento,
     “Em atraso” sem data de entrega).
   - **Calendário**: navegação de mês, reunião online com link (presencial sem
     tag de local).
   - **Documentos**: baixar o PDF.
   - **Contratos e termos**: **Assinar** o documento enviado.
   - **Orçamentos**: **Aprovar/Reprovar** e comentar.
   - **Fornecedores**: aparece após aprovar orçamento; testar filtro.
3. Sair e logar de novo com e-mail+senha (confirma que a senha ficou salva).

## O que observar

- Banner de erro vermelho em qualquer ação (me mande print + o que fazia).
- Dados **persistem após F5** (agora é banco de verdade).
- Notificações do studio (contrato/termo assinado, orçamento decidido).
- **Histórico impresso** (botão imprimir) com o lockup da marca.

## Limitações conhecidas deste teste

- **Nenhum e-mail é enviado** — o convite é link copiado (por design, por ora).
- **Assinatura é simulada** — a integração real (Autentique) entra quando você
  criar a conta e me passar o token de API.
- Sub-etapas: **apenas o studio marca** (o cliente visualiza) — é o que a
  permissão do banco permite hoje; liberar pro cliente é uma melhoria futura.
- Projeto Free **pausa após 7 dias sem uso** (religa no dashboard).
