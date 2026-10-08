# Guia para agentes (Warp, Claude Code, etc.)

Portal do Projeto — Gabriela Lendecker (arquitetura e interiores).
React 19 + Vite, dados em **dois modos**: mock (demonstração) e Supabase (produção).
O **site institucional é OUTRO repositório** — veja `docs/BRIEFING-SITE.md`.

## Comandos

- `npm run dev` — roda em modo definido pelo `.env` (`VITE_DATA_SOURCE=mock|supabase`)
- `npx vitest run` — testes (obrigatório verde)
- `npm run lint` — eslint + prettier (obrigatório limpo)
- Build nos DOIS modos antes de commitar mudanças de código:
  `VITE_DATA_SOURCE=mock npm run build` e `VITE_DATA_SOURCE=supabase npm run build`

## Regras de ouro

1. **O modo mock não pode regredir.** É o ambiente de demonstração/dev diário.
   Toda feature nova precisa funcionar (ou degradar com elegância) no mock.
2. **Nunca commitar `.env`**, chaves ou senhas. Secrets de servidor vivem no
   painel do Supabase (Edge Functions → Secrets), nunca no código.
3. **Banco muda por migração**: alterações de schema são aplicadas no projeto
   Supabase (`acqagwwjdaoodmnmtpgp`), registradas como arquivo datado em
   `supabase/sql/` E espelhadas em `src/lib/supabase/schema.sql` no MESMO
   commit. RLS em tudo. O `schema.sql` deve continuar montando do zero o
   mesmo banco da produção (conferido em 07/10/2026). Mudança aditiva
   (coluna, tabela, função) entra ANTES do código que depende dela; aperto
   de permissão entra DEPOIS do deploy do código novo.
4. A Edge Function `supabase/functions/invite-client/index.ts` é a fonte da
   verdade do convite (senha provisória). Alterou? Precisa de redeploy.
5. Strings de interface em **pt-BR**. Estética: ver tokens em
   `src/styles/theme.css` (bloco `.cp`); não introduzir libs visuais pesadas.
6. Commits em português, mensagem explicando o porquê.
7. **O cliente não faz UPDATE direto** em contratos, termos, documentos ou
   orçamentos. Ações do cliente passam por funções `security definer` com
   `search_path = ''` que conferem `owns_project` e alteram só o campo da
   ação (`responder_documento`, `responder_contrato`, `decidir_orcamento`).
   Nova ação do cliente = nova função, testada no banco simulando o dono,
   outro cliente e anônimo. O espelho no `db.js` repete as mesmas regras.
8. **CSP**: a política de conteúdo do `vercel.json` não permite
   `unsafe-eval`. Por isso o Zod roda com `z.config({ jitless: true })`
   (`src/lib/validation.js`); o teste `src/lib/csp.test.js` garante isso.

## Arquitetura de dados (importante!)

- `src/lib/db.js` — banco **mock, síncrono** (spec de referência).
- `src/lib/supabase/db-supabase.js` — espelho **assíncrono** (mesmos métodos).
- `src/lib/useResolvedDb.js` — fachada: no mock passa direto; no Supabase usa
  react-query e entrega um `db` síncrono aos componentes.
- **Novo método = 4 lugares**: db.js, db-supabase.js, listas do
  useResolvedDb (`READ_METHODS`/`ALL_MUTATIONS`/`PID_FIRST`) e
  `invalidationsFor` em `src/lib/data.js`. Leitura global (sem projeto)
  também precisa da chave própria no mapeamento do `supaSyncDb`.
- **Pendências** (sino): regra única em `src/lib/pendencias.js`, usada pelos
  dois modos. Toda mutação invalida `qk.pendencias()` automaticamente.

## Fluxos de auth (não quebrar)

- Cliente nasce com **senha provisória** (Edge Function) e o app **força a
  troca no 1º login** via metadado `must_change_password` (App.jsx +
  SetPassword.jsx). A tela também atende links `type=recovery` no hash.
- Acesso do cliente **expira 1 mês** após concluir o projeto — bloqueado no
  banco (função `owns_project`) e com tela própria no front.

## Docs

`docs/DEPLOY.md` (produção) · `docs/STATUS-E-PENDENCIAS.md` (o que existe e o
que falta) · `docs/ROTEIRO-VALIDACAO-GABRIELA.md` (roteiro de teste) ·
`docs/PLANO-PRODUCAO.md` · `docs/BRIEFING-SITE.md` (site institucional, repo
separado). Guias já cumpridos ficam em `docs/historico/`.
