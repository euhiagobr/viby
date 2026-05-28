
/**
 * @fileOverview Lógica central de gamificação: Definição de níveis e cálculos de XP.
 */

export interface LevelConfig {
  id: string;
  level: number;
  name: string;
  xpRequired: number;
  icon: string;
  color: string;
  description: string;
}

// Escala de Níveis Viby (Progressão Exponencial)
export const DEFAULT_LEVELS: LevelConfig[] = [
  { id: 'l1', level: 1, name: 'Novato', xpRequired: 0, icon: 'Zap', color: '#94a3b8', description: 'Iniciando sua jornada na Viby.' },
  { id: 'l5', level: 5, name: 'Explorador', xpRequired: 500, icon: 'Globe', color: '#3b82f6', description: 'Descobrindo novos horizontes culturais.' },
  { id: 'l10', level: 10, name: 'Rolezeiro', xpRequired: 1500, icon: 'MapPin', color: '#8b5cf6', description: 'Presente nos melhores eventos da cidade.' },
  { id: 'l20', level: 20, name: 'Influente', xpRequired: 4000, icon: 'Star', color: '#f59e0b', description: 'Referência de estilo e presença.' },
  { id: 'l30', level: 30, name: 'Ícone Cultural', xpRequired: 10000, icon: 'Award', color: '#ec4899', description: 'Um pilar da cena local.' },
  { id: 'l50', level: 50, name: 'Lenda Viby', xpRequired: 25000, icon: 'Trophy', color: '#2C52EE', description: 'O nível máximo da experiência urbana.' },
];

export interface XPRule {
  id: string;
  name: string;
  event: string;
  points: number;
  description: string;
}

export const DEFAULT_RULES: XPRule[] = [
  { id: 'signup', name: 'Primeiro Acesso', event: 'on_signup', points: 50, description: 'Bem-vindo ao clube!' },
  { id: 'follow_org', name: 'Apoio à Marca', event: 'on_follow_org', points: 15, description: 'Seguir uma organização parceira.' },
  { id: 'follow_user', name: 'Conexão Social', event: 'on_follow_user', points: 10, description: 'Seguir outro membro da comunidade.' },
  { id: 'buy_ticket', name: 'Garantir Presença', event: 'on_ticket_purchase', points: 30, description: 'Adquirir um ingresso para um evento.' },
  { id: 'checkin', name: 'Experiência Vivida', event: 'on_checkin', points: 100, description: 'Realizar o check-in no local do evento.' },
];

/**
 * Calcula o nível e progresso baseado no XP total acumulado.
 */
export function calculateLevel(totalXp: number, levels: LevelConfig[]) {
  const sortedLevels = [...levels].sort((a, b) => b.level - a.level);
  const current = sortedLevels.find(l => totalXp >= l.xpRequired) || levels[0];
  const next = levels.find(l => l.level > current.level) || null;
  
  const progress = next 
    ? ((totalXp - current.xpRequired) / (next.xpRequired - current.xpRequired)) * 100 
    : 100;

  return {
    current,
    next,
    progress: Math.min(100, Math.max(0, progress))
  };
}
