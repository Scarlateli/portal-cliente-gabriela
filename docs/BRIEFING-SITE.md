# Briefing — Site institucional (gabrielalendecker.com)

Handoff para o agente que vai construir o site (ex.: Warp). O site é um
**repositório separado** deste (sugestão: `site-gabriela`), com deploy próprio
na Vercel. Este portal fica em `portal.gabrielalendecker.com`.

## Objetivo

Site de apresentação da arquiteta **Gabriela Lendecker — arquitetura e
interiores**: elegante, minimalista, muito respiro, foco em portfólio e
contato. Uma página (one-page) já resolve a v1.

## Stack

- Vite + React (ou Astro) — **estático, sem backend**. Deploy na Vercel.
- Sem bibliotecas visuais pesadas; CSS próprio com os tokens abaixo.

## Identidade (obrigatório seguir)

- Cores (paleta atual do portal, pós-redesign): fundo `#E3DFD2` · superfície
  `#F7F2E8` · **vinho `#4B1F1B`** (marca/acentos) · tinta `#2F2119` · creme
  `#F2E9DC` · filete `rgba(63,32,25,.12)`.
- Cantos discretos (4–6px). Nada de sombras fortes ou gradientes chamativos.
- **Tipografia: Cormorant Garamond** (títulos, com itálico nos destaques) +
  **Jost** (interface e corpo), ambas do Google Fonts — é a combinação que o
  portal usa hoje, e o site deve conversar com ela.
  ⚠️ A Gabriela adquiriu licença da Futura; se quiserem usá-la no site,
  confirmar antes que a licença cobre **webfont** (uso web), que é diferente
  da licença de desktop. Na dúvida, seguir com Jost.
- Assets prontos neste repo (copiar para o site): `public/brand/monograma.png`
  (monograma vinho), `public/brand/lockup.png` (logo completa),
  `public/favicon.png`, `public/apple-touch-icon.png`.

## Banco de dados e domínio (decisão de arquitetura)

- **A v1 do site não precisa de banco de dados.** Conteúdo estático no
  código: mais rápido, mais barato, menos superfície de risco.
- **Contato**: usar WhatsApp/e-mail direto. Se um dia quiserem formulário,
  a saída é uma Edge Function no Supabase existente enviando pelo Resend —
  ainda sem banco.
- **Se o portfólio virar editável** pela Gabriela: reusar o **mesmo projeto
  Supabase**, com tabelas próprias (`site_projetos`, `site_posts`), RLS
  liberando **só leitura pública** e escrita restrita ao studio. As tabelas
  do portal não são tocadas. O site usa apenas a chave `anon` — **nunca** a
  `service_role`.
- **Domínio**: um domínio, dois projetos na Vercel —
  `gabrielalendecker.com` (site) e `portal.gabrielalendecker.com` (portal,
  já no ar). Servir o portal num caminho (`/portal`) é possível via
  rewrites, mas acopla os deploys sem ganho real: **não recomendado**.

## Estrutura da página

1. **Header** fixo: monograma pequeno + wordmark; à direita, botão destaque
   **“Portal do Cliente” → https://portal.gabrielalendecker.com**.
2. **Hero**: lockup grande, frase curta de posicionamento, CTA WhatsApp.
3. **Sobre**: 2–3 parágrafos (placeholder) + foto (placeholder).
4. **Portfólio**: grid 6 imagens placeholder (proporção 4:5), legenda curta.
5. **Como trabalho / Serviços**: 3–4 itens curtos.
6. **Contato**: botão WhatsApp (link `https://wa.me/55SEUNUMERO`), Instagram,
   e-mail. Sem formulário na v1 (sem backend).
7. **Footer**: © ano, “arquitetura e interiores”, link discreto do Portal.

## Requisitos

- pt-BR, responsivo mobile-first, imagens otimizadas (lazy), a11y básico
  (alt, foco visível, contraste), SEO: `<title>`, meta description,
  `og:image` = lockup, `lang="pt-BR"`, favicon.
- Lighthouse ≳ 90 em performance/SEO/a11y.
- Proibido: expor chaves, criar backend, usar a Futura Std, texto em inglês.

## Aceite

- Build limpo; visual coerente com o portal (mesma família de cores);
- Botão “Portal do Cliente” funcionando;
- Conteúdo em placeholders claros para a Gabriela substituir depois.
