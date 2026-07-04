/* ============================================================
   Constantes de domínio e marca.
   >>> TROCAR A MARCA AQUI (nome/logo) <<<
   - Cores e fonte: ver src/styles/theme.css (bloco BRAND TOKENS).
   ============================================================ */

export const STUDIO = { name: 'Gabriela Lendecker', tagline: 'arquitetura e interiores' };

/* Monograma oficial do estúdio (public/brand). O lockup completo, com o
   nome, fica em /brand/lockup.png e é usado no histórico impresso. */
export const LOGO = '/brand/monograma.png';

export const STAGE_STATUS = [
  { id: 'a_fazer', label: 'A fazer' },
  { id: 'em_andamento', label: 'Em andamento' },
  { id: 'concluida', label: 'Concluída' },
];

export const STAGE_CATEGORIES = [
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
