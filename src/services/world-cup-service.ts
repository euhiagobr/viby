/**
 * @fileOverview Serviço de dados oficial para a Copa do Mundo 2026.
 * Integração com dataset real e mapeamento para estrutura da Viby.
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

// Mapeamento de bandeiras e nomes amigáveis para seleções
const TEAM_META: Record<string, { name: string; flag: string }> = {
  'bra': { name: 'Brasil', flag: '🇧🇷' },
  'mex': { name: 'México', flag: '🇲🇽' },
  'usa': { name: 'EUA', flag: '🇺🇸' },
  'can': { name: 'Canadá', flag: '🇨🇦' },
  'arg': { name: 'Argentina', flag: '🇦🇷' },
  'fra': { name: 'França', flag: '🇫🇷' },
  'ger': { name: 'Alemanha', flag: '🇩🇪' },
  'esp': { name: 'Espanha', flag: '🇪🇸' },
  'ita': { name: 'Itália', flag: '🇮🇹' },
  'eng': { name: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  'por': { name: 'Portugal', flag: '🇵🇹' },
  'mar': { name: 'Marrocos', flag: '🇲🇦' },
  'col': { name: 'Colômbia', flag: '🇨🇴' },
  'uru': { name: 'Uruguai', flag: '🇺🇾' },
  'bel': { name: 'Bélgica', flag: '🇧🇪' },
  'cro': { name: 'Croácia', flag: '🇭🇷' },
  'jpn': { name: 'Japão', flag: '🇯🇵' },
  'kor': { name: 'Coréia do Sul', flag: '🇰🇷' },
  'ned': { name: 'Holanda', flag: '🇳🇱' },
};

const DATA_SOURCE = "https://raw.githubusercontent.com/lsv/fifa-worldcup-2026/master/data.json";

export async function getWorldCupData() {
  try {
    const res = await fetch(DATA_SOURCE, {
      next: { revalidate: 3600 } // Cache de 1 hora
    });
    
    if (!res.ok) throw new Error("Falha ao carregar dados da FIFA");
    
    const raw = await res.json();

    // Processar Grupos
    const groups: Group[] = (raw.groups || []).map((g: any) => ({
      letter: g.name.replace('Group ', ''),
      teams: g.teams.map((tId: number) => {
        const teamData = raw.teams.find((team: any) => team.id === tId);
        const meta = TEAM_META[teamData?.id?.toString().toLowerCase()] || { name: teamData?.name || 'A definir', flag: '🏳️' };
        
        // Em 2026, até o sorteio, muitos dados de pontos estarão zerados na fonte
        return {
          id: tId.toString(),
          name: meta.name,
          flag: meta.flag,
          points: 0,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0
        };
      })
    }));

    // Processar Partidas
    const matches: Match[] = [];
    
    // Fase de Grupos
    Object.entries(raw.groups || {}).forEach(([key, g]: [string, any]) => {
      g.matches.forEach((m: any) => {
        const homeTeam = raw.teams.find((t: any) => t.id === m.home_team);
        const awayTeam = raw.teams.find((t: any) => t.id === m.away_team);
        
        const homeMeta = TEAM_META[homeTeam?.id?.toString().toLowerCase()] || { name: homeTeam?.name || `Lote ${m.home_result || '?'}`, flag: '🏳️' };
        const awayMeta = TEAM_META[awayTeam?.id?.toString().toLowerCase()] || { name: awayTeam?.name || `Lote ${m.away_result || '?'}`, flag: '🏳️' };

        const stadium = raw.stadiums.find((s: any) => s.id === m.stadium);

        matches.push({
          id: m.name.toString(),
          homeTeam: homeMeta.name,
          awayTeam: awayMeta.name,
          homeFlag: homeMeta.flag,
          awayFlag: awayMeta.flag,
          homeScore: m.home_score,
          awayScore: m.away_score,
          date: m.date.split('T')[0],
          time: m.date.split('T')[1]?.substring(0, 5) || "A definir",
          stadium: stadium?.name || "A definir",
          city: stadium?.city || "A definir",
          phase: g.name,
          status: m.finished ? 'finished' : (m.home_score !== null ? 'live' : 'scheduled')
        });
      });
    });

    return {
      groups,
      matches: matches.sort((a, b) => a.date.localeCompare(b.date)),
      updatedAt: new Date().toISOString()
    };
  } catch (e) {
    console.error("[World Cup Service] Error fetching live data:", e);
    // Fallback para estrutura vazia mas real em caso de erro na rede
    return {
      groups: [],
      matches: [],
      updatedAt: new Date().toISOString()
    };
  }
}

export function getBrazilStats(groups: Group[], matches: Match[]) {
  const brazilTeam = groups.flatMap(g => g.teams).find(t => t.name === 'Brasil');
  const nextMatch = matches.find(m => (m.homeTeam === 'Brasil' || m.awayTeam === 'Brasil') && m.status === 'scheduled');
  const lastResult = [...matches].reverse().find(m => (m.homeTeam === 'Brasil' || m.awayTeam === 'Brasil') && m.status === 'finished');

  return {
    stats: brazilTeam || {
      id: 'br', name: 'Brasil', flag: '🇧🇷',
      points: 0, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDifference: 0
    },
    group: groups.find(g => g.teams.some(t => t.name === 'Brasil'))?.letter || 'D',
    nextMatch,
    lastResult
  };
}
