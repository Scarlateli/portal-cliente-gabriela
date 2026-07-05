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

- Cores: fundo `#d8d4ca` (areia) · cartões `#efece5` · **vinho `#5d1c17`**
  (marca/acentos) · texto `#210909` · apoio `#7a6f60`.
- Cantos discretos (4–6px). Nada de sombras fortes ou gradientes chamativos.
- **Fonte: Jost (Google Fonts)** para tudo, com tracking largo em caixa alta
  nos títulos/wordmark. ⚠️ **NÃO usar/copiar a Futura Std** deste repo — não
  há licença para distribuição web pública.
- Assets prontos neste repo (copiar para o site): `public/brand/monograma.png`
  (monograma vinho), `public/brand/lockup.png` (logo completa),
  `public/favicon.png`, `public/apple-touch-icon.png`.

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
