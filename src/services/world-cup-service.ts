
/**
 * @fileOverview Serviço de dados para a Copa do Mundo 2026.
 * Centraliza a lógica de grupos, partidas e mata-mata.
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

// Mock Robusto para o formato de 2026 (48 Seleções)
const GROUPS_MOCK: Group[] = [
  {
    letter: 'A',
    teams: [
      { id: 'mx', name: 'México', flag: '🇲🇽', points: 3, played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 0, goalDifference: 2 },
      { id: 'us', name: 'EUA', flag: '🇺🇸', points: 1, played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 1, goalsAgainst: 1, goalDifference: 0 },
      { id: 'ca', name: 'Canadá', flag: '🇨🇦', points: 1, played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 1, goalsAgainst: 1, goalDifference: 0 },
      { id: 'it', name: 'Itália', flag: '🇮🇹', points: 0, played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 2, goalDifference: -2 },
    ]
  },
  {
    letter: 'B',
    teams: [
      { id: 'br', name: 'Brasil', flag: '🇧🇷', points: 3, played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 3, goalsAgainst: 1, goalDifference: 2 },
      { id: 'fr', name: 'França', flag: '🇫🇷', points: 3, played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 1, goalsAgainst: 0, goalDifference: 1 },
      { id: 'jp', name: 'Japão', flag: '🇯🇵', points: 0, played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 1, goalsAgainst: 3, goalDifference: -2 },
      { id: 'ma', name: 'Marrocos', flag: '🇲🇦', points: 0, played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 1, goalDifference: -1 },
    ]
  },
  // Grupos adicionais seriam inseridos aqui conforme o sorteio real
];

const MATCHES_MOCK: Match[] = [
  { id: 'm1', homeTeam: 'Brasil', awayTeam: 'Espanha', homeFlag: '🇧🇷', awayFlag: '🇪🇸', date: '2026-06-15', time: '21:00', stadium: 'Estádio Azteca', city: 'Cidade do México', phase: 'Grupo B', status: 'scheduled' },
  { id: 'm2', homeTeam: 'Argentina', awayTeam: 'Portugal', homeFlag: '🇦🇷', awayFlag: '🇵🇹', date: '2026-06-16', time: '18:00', stadium: 'MetLife Stadium', city: 'Nova York', phase: 'Grupo C', status: 'scheduled' },
  { id: 'm3', homeTeam: 'México', awayTeam: 'Itália', homeFlag: '🇲🇽', awayFlag: '🇮🇹', homeScore: 2, awayScore: 0, date: '2026-06-11', time: '13:00', stadium: 'Estádio Azteca', city: 'Cidade do México', phase: 'Abertura', status: 'finished' },
  { id: 'm4', homeTeam: 'Brasil', awayTeam: 'Japão', homeFlag: '🇧🇷', awayFlag: '🇯🇵', homeScore: 3, awayScore: 1, date: '2026-06-12', time: '16:00', stadium: 'SoFi Stadium', city: 'Los Angeles', phase: 'Grupo B', status: 'finished' },
];

export async function getWorldCupData() {
  // Em produção, aqui seria feita uma chamada fetch() para uma API real com Next.js cache/revalidate
  // Ex: const res = await fetch('https://api.football-data.org/v4/competitions/WC/standings', { next: { revalidate: 3600 } });
  
  return {
    groups: GROUPS_MOCK,
    matches: MATCHES_MOCK,
    updatedAt: new Date().toISOString()
  };
}

export function getBrazilStats(groups: Group[], matches: Match[]) {
  const brazilGroup = groups.find(g => g.teams.some(t => t.name === 'Brasil'));
  const teamStats = brazilGroup?.teams.find(t => t.name === 'Brasil');
  const nextMatch = matches.find(m => (m.homeTeam === 'Brasil' || m.awayTeam === 'Brasil') && m.status === 'scheduled');
  const lastResult = [...matches].reverse().find(m => (m.homeTeam === 'Brasil' || m.awayTeam === 'Brasil') && m.status === 'finished');

  return {
    stats: teamStats,
    group: brazilGroup?.letter,
    nextMatch,
    lastResult
  };
}
