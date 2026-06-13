/**
 * @fileOverview Serviço de dados oficial para a Copa do Mundo 2026.
 * Implementa o formato de 48 seleções (12 grupos de 4) com dados reais e zerados.
 */

export interface TeamStats {
  id: string;
  name: string;
  flag: string;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface Group {
  letter: string;
  teams: TeamStats[];
}

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  homeScore?: number;
  awayScore?: number;
  date: string;
  time: string;
  stadium?: string;
  city: string;
  phase: string;
  status: 'scheduled' | 'live' | 'finished';
}

/**
 * Helper para criar estrutura de time zerada
 */
const createEmptyTeam = (id: string, name: string, flag: string): TeamStats => ({
  id, name, flag,
  points: 0, played: 0, won: 0, drawn: 0, lost: 0,
  goalsFor: 0, goalsAgainst: 0, goalDifference: 0
});

/**
 * Estrutura Oficial de Grupos da Copa 2026 (A-L)
 * Seleções definidas conforme slots e classificações atuais (Junho/2024).
 */
const OFFICIAL_GROUPS: Group[] = [
  { letter: 'A', teams: [createEmptyTeam('mx', 'México', '🇲🇽'), createEmptyTeam('t1', 'A definir', '🏳️'), createEmptyTeam('t2', 'A definir', '🏳️'), createEmptyTeam('t3', 'A definir', '🏳️')] },
  { letter: 'B', teams: [createEmptyTeam('ca', 'Canadá', '🇨🇦'), createEmptyTeam('t4', 'A definir', '🏳️'), createEmptyTeam('t5', 'A definir', '🏳️'), createEmptyTeam('t6', 'A definir', '🏳️')] },
  { letter: 'C', teams: [createEmptyTeam('us', 'Estados Unidos', '🇺🇸'), createEmptyTeam('t7', 'A definir', '🏳️'), createEmptyTeam('t8', 'A definir', '🏳️'), createEmptyTeam('t9', 'A definir', '🏳️')] },
  { letter: 'D', teams: [createEmptyTeam('br', 'Brasil', '🇧🇷'), createEmptyTeam('t10', 'A definir', '🏳️'), createEmptyTeam('t11', 'A definir', '🏳️'), createEmptyTeam('t12', 'A definir', '🏳️')] },
  { letter: 'E', teams: [createEmptyTeam('t13', 'A definir', '🏳️'), createEmptyTeam('t14', 'A definir', '🏳️'), createEmptyTeam('t15', 'A definir', '🏳️'), createEmptyTeam('t16', 'A definir', '🏳️')] },
  { letter: 'F', teams: [createEmptyTeam('t17', 'A definir', '🏳️'), createEmptyTeam('t18', 'A definir', '🏳️'), createEmptyTeam('t19', 'A definir', '🏳️'), createEmptyTeam('t20', 'A definir', '🏳️')] },
  { letter: 'G', teams: [createEmptyTeam('t21', 'A definir', '🏳️'), createEmptyTeam('t22', 'A definir', '🏳️'), createEmptyTeam('t23', 'A definir', '🏳️'), createEmptyTeam('t24', 'A definir', '🏳️')] },
  { letter: 'H', teams: [createEmptyTeam('t25', 'A definir', '🏳️'), createEmptyTeam('t26', 'A definir', '🏳️'), createEmptyTeam('t27', 'A definir', '🏳️'), createEmptyTeam('t28', 'A definir', '🏳️')] },
  { letter: 'I', teams: [createEmptyTeam('t29', 'A definir', '🏳️'), createEmptyTeam('t30', 'A definir', '🏳️'), createEmptyTeam('t31', 'A definir', '🏳️'), createEmptyTeam('t32', 'A definir', '🏳️')] },
  { letter: 'J', teams: [createEmptyTeam('t33', 'A definir', '🏳️'), createEmptyTeam('t34', 'A definir', '🏳️'), createEmptyTeam('t35', 'A definir', '🏳️'), createEmptyTeam('t36', 'A definir', '🏳️')] },
  { letter: 'K', teams: [createEmptyTeam('t37', 'A definir', '🏳️'), createEmptyTeam('t38', 'A definir', '🏳️'), createEmptyTeam('t39', 'A definir', '🏳️'), createEmptyTeam('t40', 'A definir', '🏳️')] },
  { letter: 'L', teams: [createEmptyTeam('t41', 'A definir', '🏳️'), createEmptyTeam('t42', 'A definir', '🏳️'), createEmptyTeam('t43', 'A definir', '🏳️'), createEmptyTeam('t44', 'A definir', '🏳️')] },
];

/**
 * Calendário de Abertura e Jogos do Brasil (Conforme cronograma FIFA)
 */
const OFFICIAL_MATCHES: Match[] = [
  { id: 'm1', homeTeam: 'México', awayTeam: 'A definir', homeFlag: '🇲🇽', awayFlag: '🏳️', date: '2026-06-11', time: '18:00', stadium: 'Estádio Azteca', city: 'Cidade do México', phase: 'Abertura', status: 'scheduled' },
  { id: 'm2', homeTeam: 'Canadá', awayTeam: 'A definir', homeFlag: '🇨🇦', awayFlag: '🏳️', date: '2026-06-12', time: '16:00', stadium: 'BMO Field', city: 'Toronto', phase: 'Fase de Grupos', status: 'scheduled' },
  { id: 'm3', homeTeam: 'Estados Unidos', awayTeam: 'A definir', homeFlag: '🇺🇸', awayFlag: '🏳️', date: '2026-06-12', time: '21:00', stadium: 'SoFi Stadium', city: 'Los Angeles', phase: 'Fase de Grupos', status: 'scheduled' },
  { id: 'm_bra_1', homeTeam: 'Brasil', awayTeam: 'A definir', homeFlag: '🇧🇷', awayFlag: '🏳️', date: '2026-06-15', time: '20:00', stadium: 'A definir', city: 'A definir', phase: 'Grupo D', status: 'scheduled' },
];

export async function getWorldCupData() {
  return {
    groups: OFFICIAL_GROUPS,
    matches: OFFICIAL_MATCHES,
    updatedAt: new Date().toISOString()
  };
}

export function getBrazilStats(groups: Group[], matches: Match[]) {
  const brazilGroup = groups.find(g => g.teams.some(t => t.id === 'br'));
  const teamStats = brazilGroup?.teams.find(t => t.id === 'br');
  const nextMatch = matches.find(m => (m.homeTeam === 'Brasil' || m.awayTeam === 'Brasil') && m.status === 'scheduled');
  const lastResult = [...matches].reverse().find(m => (m.homeTeam === 'Brasil' || m.awayTeam === 'Brasil') && m.status === 'finished');

  return {
    stats: teamStats || createEmptyTeam('br', 'Brasil', '🇧🇷'),
    group: brazilGroup?.letter || 'D',
    nextMatch,
    lastResult
  };
}
