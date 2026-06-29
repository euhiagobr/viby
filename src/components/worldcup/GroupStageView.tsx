
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Standing } from '@/types/worldcup';
import { cn } from "@/lib/utils";

const BRAZIL_ID = 764;

interface GroupStageViewProps {
  standings?: Standing[];
}

export function GroupStageView({ standings }: GroupStageViewProps) {
  if (!standings) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
      {standings.filter(s => s.type === 'TOTAL').map((group) => (
        <Card key={group.group} className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="bg-muted/30 border-b p-6">
            <CardTitle className="text-lg font-black italic uppercase tracking-tighter text-primary">
              Grupo {group.group?.replace('GROUP_', '')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left min-w-[500px]">
              <thead className="bg-muted/10">
                <tr className="text-[8px] font-black uppercase text-muted-foreground border-b">
                  <th className="px-6 py-4">Seleção</th>
                  <th className="px-2 py-4 text-center">Pts</th>
                  <th className="px-2 py-4 text-center">J</th>
                  <th className="px-2 py-4 text-center">V</th>
                  <th className="px-2 py-4 text-center">E</th>
                  <th className="px-2 py-4 text-center">D</th>
                  <th className="px-2 py-4 text-center">SG</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {group.table.map((entry) => (
                  <tr key={entry.team.id} className={cn("hover:bg-muted/5 transition-colors", entry.team.id === BRAZIL_ID && "bg-green-50/20")}>
                    <td className="px-6 py-4 flex items-center gap-3">
                      <span className="text-[10px] font-bold opacity-30 w-4">{entry.position}º</span>
                      <div className="h-5 w-7 bg-muted rounded overflow-hidden relative border shadow-sm shrink-0">
                        <img src={entry.team.crest} alt="" className="object-cover w-full h-full" />
                      </div>
                      <span className={cn("font-bold text-xs uppercase text-primary truncate max-w-[140px]", entry.team.id === BRAZIL_ID && "text-[#009c3b] font-black")}>
                        {entry.team.name}
                      </span>
                    </td>
                    <td className="px-2 py-4 text-center font-black text-xs text-primary">{entry.points}</td>
                    <td className="px-2 py-4 text-center text-[10px] opacity-60 font-bold">{entry.playedGames}</td>
                    <td className="px-2 py-4 text-center text-[10px] opacity-60 font-bold">{entry.won}</td>
                    <td className="px-2 py-4 text-center text-[10px] opacity-60 font-bold">{entry.draw}</td>
                    <td className="px-2 py-4 text-center text-[10px] opacity-60 font-bold">{entry.lost}</td>
                    <td className={cn("px-2 py-4 text-center text-xs font-black", entry.goalDifference > 0 ? "text-green-600" : entry.goalDifference < 0 ? "text-red-500" : "text-muted-foreground")}>
                      {entry.goalDifference}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
