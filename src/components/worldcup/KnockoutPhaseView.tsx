
'use client';

import * as React from 'react';
import { Match } from '@/types/worldcup';
import { BracketMatchCard } from './BracketMatchCard';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const BRAZIL_ID = 764;

interface KnockoutPhaseViewProps {
  matches?: Match[];
}

const STAGE_LABELS: Record<string, string> = {
  'ROUND_OF_16': 'Oitavas de Final',
  'QUARTER_FINALS': 'Quartas de Final',
  'SEMI_FINALS': 'Semifinais',
  'THIRD_PLACE': 'Terceiro Lugar',
  'FINAL': 'Final'
};

const STAGE_ORDER = ['ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL'];

export function KnockoutPhaseView({ matches }: KnockoutPhaseViewProps) {
  if (!matches) return null;

  const knockoutMatches = matches.filter(m => m.stage !== 'GROUP_STAGE');

  const grouped = React.useMemo(() => {
    const stages: Record<string, Match[]> = {};
    knockoutMatches.forEach(m => {
      if (!stages[m.stage]) stages[m.stage] = [];
      stages[m.stage].push(m);
    });
    return stages;
  }, [knockoutMatches]);

  // A Final e o Terceiro lugar são tratados na mesma coluna ou colunas próximas
  const rounds = STAGE_ORDER.filter(s => grouped[s] || s === 'FINAL');

  return (
    <ScrollArea className="w-full whitespace-nowrap pb-10">
      <div className="flex gap-8 p-4 min-w-max items-start">
        {rounds.map((roundKey) => (
          <div key={roundKey} className="flex flex-col gap-8 w-[280px]">
            <div className="flex items-center gap-3 px-2">
              <div className="w-1.5 h-6 bg-secondary rounded-full" />
              <h3 className="text-sm font-black uppercase italic tracking-tighter text-primary">
                {STAGE_LABELS[roundKey]}
              </h3>
            </div>

            <div className="space-y-6 flex flex-col justify-around min-h-[600px]">
              {grouped[roundKey]?.map((match) => (
                <BracketMatchCard 
                  key={match.id} 
                  match={match} 
                  highlightTeamId={BRAZIL_ID} 
                />
              ))}
              
              {!grouped[roundKey] && (
                <div className="p-8 text-center bg-white/50 border-2 border-dashed rounded-[2rem] opacity-30">
                  <p className="text-[10px] font-black uppercase tracking-widest whitespace-normal">
                    Confrontos a definir
                  </p>
                </div>
              )}

              {roundKey === 'FINAL' && grouped['THIRD_PLACE'] && (
                <div className="mt-12 space-y-6">
                   <div className="flex items-center gap-3 px-2">
                    <div className="w-1.5 h-6 bg-muted-foreground/30 rounded-full" />
                    <h3 className="text-sm font-black uppercase italic tracking-tighter text-muted-foreground">
                      {STAGE_LABELS['THIRD_PLACE']}
                    </h3>
                  </div>
                  {grouped['THIRD_PLACE'].map(match => (
                    <BracketMatchCard key={match.id} match={match} highlightTeamId={BRAZIL_ID} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
