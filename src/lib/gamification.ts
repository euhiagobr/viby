
/**
 * @fileOverview Lógica principal do sistema de gamificação Viby.
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
  category?: string;
  limit?: number; // 0 for unlimited
}

export const DEFAULT_RULES: XPRule[] = [
  { id: 'signup', name: 'Criar Conta', event: 'on_signup', points: 50 },
  { id: 'profile_complete', name: 'Perfil Completo', event: 'on_profile_complete', points: 100 },
  { id: 'follow_user', name: 'Seguir Usuário', event: 'on_follow_user', points: 10 },
  { id: 'follow_org', name: 'Seguir Marca', event: 'on_follow_org', points: 15 },
  { id: 'buy_ticket', name: 'Comprar Ingresso', event: 'on_ticket_purchase', points: 30 },
  { id: 'checkin', name: 'Realizar Check-in', event: 'on_checkin', points: 100 },
  { id: 'new_category', name: 'Explorar Nova Categoria', event: 'on_new_category', points: 50 },
  { id: 'new_city', name: 'Explorar Nova Cidade', event: 'on_new_city', points: 150 },
  { id: 'new_neighborhood', name: 'Explorar Novo Bairro', event: 'on_new_neighborhood', points: 50 },
];

/**
 * Calcula o nível baseado no XP total.
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
