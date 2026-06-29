
'use client';

import * as React from 'react';
import { Match } from '@/types/worldcup';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin } from 'lucide-react';

interface BracketMatchCardProps {
  match: Match;
  highlightTeamId?: number;
}

export function BracketMatchCard({ match, highlightTeamId }: BracketMatchCardProps) {
  const isFinished = match.status === 'FINISHED';
  const isLive = ['IN_PLAY', 'PAUSED'].includes(match.status);
  
  const renderTeam = (team: any, score: number | null, isHome: boolean) => {
    const isWinner = isFinished && ((isHome && match.score.winner === 'HOME_TEAM') || (!isHome && match.score.winner === 'AWAY_TEAM'));
    const isHighlighted = team?.id === highlightTeamId;

    return (
      <div className={cn(
        "flex items-center justify-between p-3 rounded-xl transition-all",
        isWinner ? "bg-secondary/10" : "bg-transparent",
        isHighlighted && "ring-1 ring-secondary"
      )}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-5 w-7 bg-muted rounded overflow-hidden border shadow-sm shrink-0">
            {team?.crest ? (
              <img src={team.crest} alt="" className="object-cover w-full h-full" />
            ) : (
              <div className="w-full h-full bg-muted-foreground/10" />
            )}
          </div>
          <span className={cn(
            "text-xs uppercase font-bold truncate",
            isWinner ? "text-primary font-black" : "text-muted-foreground",
            isHighlighted && "text-secondary"
          )}>
            {team?.shortName || team?.name || 'A DEFINIR'}
          </span>
        </div>
        <span className={cn(
          "text-sm font-black w-6 text-center",
          isWinner ? "text-primary" : "text-muted-foreground",
          score === null && "opacity-0"
        )}>
          {score ?? 0}
        </span>
      </div>
    );
  };

  return (
    <div className={cn(
      "w-full bg-white border rounded-[1.5rem] shadow-sm overflow-hidden transition-all hover:shadow-md",
      isLive && "ring-2 ring-red-500 animate-in zoom-in-95"
    )}>
      <div className="bg-muted/30 px-4 py-2 flex justify-between items-center border-b">
        <Badge variant="outline" className={cn(
          "text-[7px] font-black uppercase h-4 px-1.5 border-none",
          isLive ? "bg-red-500 text-white" : isFinished ? "bg-muted text-muted-foreground" : "bg-secondary/10 text-secondary"
        )}>
          {isLive ? 'AO VIVO' : isFinished ? 'FIM' : 'AGENDADO'}
        </Badge>
        <span className="text-[8px] font-black text-muted-foreground uppercase">
          {new Date(match.utcDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
        </span>
      </div>
      
      <div className="p-2 space-y-1">
        {renderTeam(match.homeTeam, match.score.fullTime.home, true)}
        {renderTeam(match.awayTeam, match.score.fullTime.away, false)}
      </div>

      <div className="px-4 py-2 bg-muted/5 border-t border-dashed flex items-center justify-between opacity-40">
         <div className="flex items-center gap-1.5 text-[8px] font-black uppercase truncate">
            <Clock className="w-2.5 h-2.5" />
            {new Date(match.utcDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
         </div>
         {match.venue && (
           <div className="flex items-center gap-1.5 text-[8px] font-black uppercase truncate">
              <MapPin className="w-2.5 h-2.5" />
              {match.venue.split(',')[0]}
           </div>
         )}
      </div>
    </div>
  );
}
