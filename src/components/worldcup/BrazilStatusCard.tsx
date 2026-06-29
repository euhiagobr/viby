'use client';

import * as React from 'react';
import { Match, Standing } from '@/types/worldcup';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, TrendingUp, Clock, MapPin, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const BRAZIL_ID = 764;

interface BrazilStatusCardProps {
  standings?: Standing[];
  nextMatch?: Match | null;
  loading?: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  'GROUP_STAGE': 'Fase de Grupos',
  'ROUND_OF_32': '16-avos de Final',
  'LAST_32': '16-avos de Final',
  'ROUND_OF_16': 'Oitavas de Final',
  'LAST_16': 'Oitavas de Final',
  'QUARTER_FINALS': 'Quartas de Final',
  'SEMI_FINALS': 'Semifinais',
  'THIRD_PLACE': 'Terceiro Lugar',
  'FINAL': 'Final'
};

export function BrazilStatusCard({ standings, nextMatch, loading }: BrazilStatusCardProps) {
  const brazilStats = React.useMemo(() => {
    if (!standings) return null;
    for (const standing of standings) {
      if (standing.type !== 'TOTAL') continue;
      const entry = standing.table.find(t => t.team.id === BRAZIL_ID);
      if (entry) return { entry, group: standing.group?.replace('GROUP_', '') };
    }
    return null;
  }, [standings]);

  const isEliminated = React.useMemo(() => {
    if (!nextMatch && brazilStats?.entry.position && brazilStats.entry.position > 2 && brazilStats.group) return true;
    // Se o último jogo foi mata-mata e o Brasil perdeu
    if (nextMatch?.status === 'FINISHED') {
       const isHome = nextMatch.homeTeam?.id === BRAZIL_ID;
       const winner = nextMatch.score.winner;
       if ((isHome && winner === 'AWAY_TEAM') || (!isHome && winner === 'HOME_TEAM')) return true;
    }
    return false;
  }, [nextMatch, brazilStats]);

  const isLive = nextMatch?.status === 'IN_PLAY' || nextMatch?.status === 'PAUSED';

  return (
    <Card className="border-none shadow-2xl rounded-[3rem] bg-primary text-white overflow-hidden relative group">
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#ffdf00]/10 rounded-full -mr-32 -mt-32 blur-3xl transition-transform group-hover:scale-110" />
      
      <CardContent className="p-8 md:p-12 flex flex-col md:flex-row gap-10 items-center relative z-10">
        <div className="flex flex-col items-center gap-4 text-center md:text-left md:items-start shrink-0">
          <div className="text-8xl md:text-9xl font-black italic tracking-tighter leading-none text-[#ffdf00]">BRA</div>
          <Badge className={cn(
            "text-white font-black uppercase text-[10px] tracking-widest px-4 border-none h-6 shadow-lg",
            isEliminated ? "bg-red-500" : "bg-[#009c3b]"
          )}>
            {isEliminated ? 'Fim da Jornada' : 'Rumo ao Hexa'}
          </Badge>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase opacity-40 tracking-widest flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" /> 
              {nextMatch?.stage === 'GROUP_STAGE' || !nextMatch?.stage ? `Grupo ${brazilStats?.group || '---'}` : STAGE_LABELS[nextMatch.stage]}
            </p>
            <div className="space-y-2">
              {loading ? <Skeleton className="h-10 w-32 bg-white/10 rounded-lg" /> : (
                <div className="flex justify-between items-end">
                  <span className="text-3xl font-black">
                    {isEliminated ? 'Eliminado' : isLive ? 'EM CAMPO' : 'Classificado'}
                  </span>
                </div>
              )}
              {!isEliminated && brazilStats?.entry && (
                <div className="flex gap-2">
                   {Array.from({length: 3}).map((_, i) => (
                     <div key={i} className={cn("w-2 h-2 rounded-full", (brazilStats.entry.won && i < brazilStats.entry.won) ? "bg-[#009c3b]" : "bg-white/20")} />
                   ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase opacity-40 tracking-widest flex items-center gap-2">
              {isLive ? <Zap className="w-3.5 h-3.5 text-red-500 animate-pulse fill-current" /> : <Clock className="w-3.5 h-3.5" />}
              {isLive ? 'Jogo em Andamento' : 'Próxima Partida'}
            </p>
            {loading ? <div className="space-y-2"><Skeleton className="h-4 w-40 bg-white/10" /><Skeleton className="h-3 w-32 bg-white/10" /></div> : nextMatch ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                   <p className="font-black text-sm uppercase italic text-[#ffdf00] truncate">
                     vs {nextMatch.homeTeam?.id === BRAZIL_ID ? (nextMatch.awayTeam?.name || 'TBD') : (nextMatch.homeTeam?.name || 'TBD')}
                   </p>
                   {isLive && (
                     <Badge className="bg-red-500 text-white text-[8px] font-black h-4 px-1 animate-pulse">
                        {nextMatch.score.fullTime.home} - {nextMatch.score.fullTime.away}
                     </Badge>
                   )}
                </div>
                <p className="text-xs font-bold uppercase">
                  {new Date(nextMatch.utcDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} • {new Date(nextMatch.utcDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
                {nextMatch.venue && <p className="text-[9px] font-bold opacity-50 uppercase truncate flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {nextMatch.venue}</p>}
              </div>
            ) : <p className="text-xs opacity-60 uppercase font-black">{isEliminated ? 'Obrigado por torcer!' : 'Aguardando definição'}</p>}
          </div>

          <div className="flex flex-col justify-center">
            <Button asChild className="bg-[#009c3b] text-white font-black rounded-2xl h-14 uppercase italic shadow-xl shadow-green-900/20 hover:scale-105 transition-transform">
              <Link href="/copa-do-mundo">Onde Assistir <ArrowRight className="ml-2 w-4 h-4" /></Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}