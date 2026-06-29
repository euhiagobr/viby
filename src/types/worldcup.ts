
export interface Competition {
  id: number;
  name: string;
  code: string;
  type: string;
  emblem: string;
}

export interface Team {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

export interface TableEntry {
  position: number;
  team: Team;
  playedGames: number;
  form: string | null;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface Standing {
  stage: string;
  type: string;
  group: string | null;
  table: TableEntry[];
}

export interface ScoreValue {
  home: number | null;
  away: number | null;
}

export interface Score {
  winner: string | null;
  duration: string;
  fullTime: ScoreValue;
  halfTime: ScoreValue;
}

export interface Match {
  id: number;
  utcDate: string;
  status: 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'CANCELLED' | 'POSTPONED';
  matchday: number;
  stage: 'GROUP_STAGE' | 'ROUND_OF_16' | 'QUARTER_FINALS' | 'SEMI_FINALS' | 'THIRD_PLACE' | 'FINAL';
  group: string | null;
  lastUpdated: string;
  homeTeam: Team | null;
  awayTeam: Team | null;
  score: Score;
  venue: string | null;
}

export interface FootballDataResponse<T> {
  competition: Competition;
  filters: any;
  standings?: Standing[];
  matches?: Match[];
}
