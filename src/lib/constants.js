/* ============================================================
   Constantes de domínio e marca.
   >>> TROCAR A MARCA AQUI (nome/logo) <<<
   - Cores e fonte: ver src/styles/theme.css (bloco BRAND TOKENS).
   ============================================================ */

export const STUDIO = { name: 'Gabriela Lendecker', tagline: 'arquitetura e interiores' };

/* Monograma oficial do estúdio (public/brand). O lockup completo, com o
   nome, fica em /brand/lockup.png e é usado no histórico impresso. */
export const LOGO = '/brand/monograma.png';
export const LOCKUP = '/brand/lockup.png';

export const STAGE_STATUS = [
  { id: 'a_fazer', label: 'A fazer' },
  { id: 'em_andamento', label: 'Em andamento' },
  { id: 'concluida', label: 'Concluída' },
];

// "Etapa" é a fase do projeto (Briefing, Anteprojeto…), que agrupa
// sub-etapas; os demais tipos servem para etapas que são um evento só.
export const STAGE_CATEGORIES = [
  'Etapa',
  'Reunião',
  'Entrega',
  'Visita técnica',
  'Documentação',
  'Produção',
  'Outro',
];

export const DOC_TYPES = [
  { id: 'ata', label: 'Ata de reunião' },
  { id: 'briefing', label: 'Briefing' },
  { id: 'contrato', label: 'Contrato' },
  { id: 'planta', label: 'Plantas e projetos' },
  { id: 'geral', label: 'Documentos gerais' },
];

export const SEGMENTS = [
  'Marcenaria',
  'Iluminação',
  'Marmoraria',
  'Elétrica',
  'Hidráulica',
  'Pintura',
  'Mobiliário',
  'Climatização',
  'Revestimentos',
  'Paisagismo',
  'Geral',
];

export const SIG_PROVIDERS = ['Autentique', 'ZapSign', 'Clicksign', 'D4Sign'];

export const CONTRACT_STATUS = [
  { id: 'a_iniciar', label: 'A iniciar' },
  { id: 'em_producao', label: 'Em produção' },
  { id: 'entregue', label: 'Entregue' },
];

export const WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Foto de capa da tela de entrada (arquivo em public/brand/), mostrada clara,
// com névoa por cima. Vazio = fundo liso na cor bege. Para trocar a foto:
// substituir public/brand/capa-login.jpg (paisagem, até ~400 KB).
export const CAPA_LOGIN = '/brand/capa-login.jpg';
