'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Trophy, 
  Calendar, 
  ChevronRight, 
  Tv, 
  TrendingUp, 
  ShieldCheck,
  Star,
  MapPin,
  Clock,
  LayoutGrid,
  Info,
  ArrowRight,
  History as HistoryIcon
} from 'lucide-react';
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Group, Match, TeamStats } from "@/services/world-cup-service";

interface TabelaClientProps {
  data: {
    groups: Group[];
    matches: Match[];
    updatedAt: string;
  };
  brazilStats: any;
}

export default function TabelaClient({ data, brazilStats }: TabelaClientProps) {
  const [activeTab, setActiveTab] = React.useState("groups");

  const results = data.matches.filter(m => m.status === 'finished');
  const upcoming = data.matches.filter(m => m.status === 'scheduled');

  const hasPlayed = brazilStats.stats?.played > 0;

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      {/* DESTAQUE BRASIL */}
      <section className="relative">
         <Card className="border-none shadow-2xl rounded-[3rem] bg-primary text-white overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#ffdf00]/10 rounded-full -mr-32 -mt-32 blur-3xl" />
            <CardContent className="p-8 md:p-12 flex flex-col md:flex-row gap-10 items-center relative z-10">
               <div className="flex flex-col items-center gap-4 text-center md:text-left md:items-start shrink-0">
                  <div className="text-8xl md:text-9xl font-black italic tracking-tighter leading-none text-[#ffdf00]">BRA</div>
                  <Badge className="bg-[#009c3b] text-white font-black uppercase text-[10px] tracking-widest px-4 border-none h-6">Rumo ao Hexa</Badge>
               </div>

               <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
                  <div className="space-y-4">
                     <p className="text-[10px] font-black uppercase opacity-40 tracking-widest flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5" /> Classificação Grupo {brazilStats.group}</p>
                     <div className="space-y-2">
                        <div className="flex justify-between items-end">
                           <span className="text-3xl font-black">{brazilStats.stats?.points || 0} pts</span>
                           <span className="text-xs font-bold opacity-60">{hasPlayed ? "Desempenho Real" : "Aguardando Início"}</span>
                        </div>
                        <div className="flex gap-2">
                           {Array.from({length: 3}).map((_, i) => (
                             <div key={i} className={cn("w-2 h-2 rounded-full", (hasPlayed && i < (brazilStats.stats?.won || 0)) ? "bg-[#009c3b]" : "bg-white/20")} />
                           ))}
                        </div>
                     </div>
                  </div>

                  <div className="space-y-4">
                     <p className="text-[10px] font-black uppercase opacity-40 tracking-widest flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Próximo Jogo</p>
                     {brazilStats.nextMatch ? (
                       <div className="space-y-1">
                          <p className="font-black text-sm uppercase italic text-[#ffdf00]">vs {brazilStats.nextMatch.awayTeam}</p>
                          <p className="text-xs font-bold">{new Date(brazilStats.nextMatch.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} • {brazilStats.nextMatch.time}</p>
                       </div>
                     ) : <p className="text-xs opacity-60">Confrontos a definir.</p>}
                  </div>

                  <div className="flex flex-col justify-center">
                     <Button asChild className="bg-[#009c3b] text-white font-black rounded-2xl h-14 uppercase italic shadow-xl shadow-green-900/20 hover:scale-105 transition-transform">
                        <Link href="/copa-do-mundo">Onde Assistir o Brasil <ArrowRight className="ml-2 w-4 h-4" /></Link>
                     </Button>
                  </div>
               </div>
            </CardContent>
         </Card>
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-10">
        <div className="flex justify-center">
           <TabsList className="bg-muted/50 p-1 rounded-2xl h-14">
              <TabsTrigger value="groups" className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest gap-2">Classificação</TabsTrigger>
              <TabsTrigger value="matches" className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest gap-2">Tabela de Jogos</TabsTrigger>
              <TabsTrigger value="bracket" className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest gap-2">Mata-Mata</TabsTrigger>
           </TabsList>
        </div>

        <TabsContent value="groups" className="space-y-10">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {data.groups.map((group) => (
                <Card key={group.letter} className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
                   <CardHeader className="bg-muted/30 border-b p-6">
                      <CardTitle className="text-lg font-black italic uppercase tracking-tighter text-primary">Grupo {group.letter}</CardTitle>
                   </CardHeader>
                   <CardContent className="p-0">
                      <table className="w-full text-left">
                         <thead className="bg-muted/10">
                            <tr className="text-[8px] font-black uppercase text-muted-foreground border-b">
                               <th className="px-6 py-4">Seleção</th>
                               <th className="px-2 py-4 text-center">P</th>
                               <th className="px-2 py-4 text-center">J</th>
                               <th className="px-2 py-4 text-center">V</th>
                               <th className="px-2 py-4 text-center">SG</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y">
                            {group.teams.map((team, idx) => (
                              <tr key={team.id} className={cn("hover:bg-muted/5", (team.points > 0 && idx < 2) && "bg-green-50/20")}>
                                 <td className="px-6 py-4 flex items-center gap-3">
                                    <span className="text-[10px] font-bold opacity-30 w-3">{idx + 1}</span>
                                    <span className="text-xl">{team.flag}</span>
                                    <span className="font-bold text-xs uppercase text-primary">{team.name}</span>
                                 </td>
                                 <td className="px-2 py-4 text-center font-black text-xs">{team.points}</td>
                                 <td className="px-2 py-4 text-center text-xs opacity-60 font-bold">{team.played}</td>
                                 <td className="px-2 py-4 text-center text-xs opacity-60 font-bold">{team.won}</td>
                                 <td className="px-2 py-4 text-center text-xs font-black text-secondary">{team.goalDifference}</td>
                              </tr>
                            ))}
                         </tbody>
                      </table>
                   </CardContent>
                </Card>
              ))}
           </div>
        </TabsContent>

        <TabsContent value="matches" className="space-y-12">
           <section className="space-y-6">
              <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary flex items-center gap-3 px-2">
                 <Calendar className="w-5 h-5 text-secondary" /> Próximas Partidas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {upcoming.length > 0 ? upcoming.map(match => (
                   <MatchCard key={match.id} match={match} />
                 )) : (
                   <div className="col-span-full py-10 text-center opacity-30 italic text-sm uppercase font-bold">Calendário oficial em definição</div>
                 )}
              </div>
           </section>

           <section className="space-y-6">
              <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary flex items-center gap-3 px-2 opacity-60">
                 <HistoryIcon className="w-5 h-5" /> Resultados Recentes
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {results.length > 0 ? results.map(match => (
                   <MatchCard key={match.id} match={match} />
                 )) : (
                   <div className="col-span-full py-10 text-center opacity-30 italic text-sm uppercase font-bold">Nenhuma partida realizada</div>
                 )}
              </div>
           </section>
        </TabsContent>

        <TabsContent value="bracket" className="py-20 text-center space-y-6 bg-white rounded-[3rem] border-2 border-dashed">
            <Trophy className="w-16 h-16 text-secondary mx-auto opacity-20" />
            <div className="space-y-2">
               <h3 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Fase Final em Construção</h3>
               <p className="text-sm text-muted-foreground font-medium uppercase max-w-xs mx-auto">O chaveamento do mata-mata será habilitado assim que a fase de grupos for concluída.</p>
            </div>
        </TabsContent>
      </Tabs>

      <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-start gap-4 max-w-2xl mx-auto">
         <span className="shrink-0 mt-0.5"><Info className="w-6 h-6 text-secondary" /></span>
         <div className="space-y-1">
            <h4 className="font-black uppercase text-[10px] tracking-widest text-secondary">Dados Oficiais</h4>
            <p className="text-[10px] text-muted-foreground font-bold uppercase leading-relaxed">
               As informações de jogos e classificação são atualizadas automaticamente via feeds oficiais da FIFA. Última sincronização: {new Date(data.updatedAt).toLocaleString('pt-BR')}.
            </p>
         </div>
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: Match }) {
  const isFinished = match.status === 'finished';

  return (
    <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden group hover:shadow-xl transition-all">
       <CardContent className="p-0">
          <div className="bg-muted/30 p-4 border-b flex justify-between items-center">
             <Badge variant="outline" className="text-[8px] font-black uppercase border-secondary/20 text-secondary">{match.phase}</Badge>
             <span className="text-[9px] font-bold text-muted-foreground uppercase">{new Date(match.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} • {match.time}</span>
          </div>
          <div className="p-8 flex items-center justify-between gap-4">
             <div className="flex flex-col items-center gap-3 flex-1">
                <span className="text-4xl">{match.homeFlag}</span>
                <span className="font-black text-sm uppercase italic text-primary text-center leading-none">{match.homeTeam}</span>
             </div>
             
             <div className="flex flex-col items-center gap-2 shrink-0">
                {isFinished ? (
                   <div className="text-3xl font-black italic tracking-tighter flex items-center gap-4 bg-primary text-white px-6 py-2 rounded-2xl shadow-lg">
                      <span>{match.homeScore}</span>
                      <span className="opacity-20 text-sm">X</span>
                      <span>{match.awayScore}</span>
                   </div>
                ) : (
                   <div className="text-xs font-black uppercase opacity-20 italic">VS</div>
                )}
             </div>

             <div className="flex flex-col items-center gap-3 flex-1">
                <span className="text-4xl">{match.awayFlag}</span>
                <span className="font-black text-sm uppercase italic text-primary text-center leading-none">{match.awayTeam}</span>
             </div>
          </div>
          <div className="p-4 border-t border-dashed bg-muted/5 flex flex-col sm:flex-row items-center justify-between gap-4">
             <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase truncate">
                <MapPin className="w-3.5 h-3.5" /> {match.stadium || match.city}
             </div>
             {!isFinished && (
               <Button asChild variant="ghost" size="sm" className="h-8 rounded-xl font-black uppercase italic text-[9px] gap-2 text-secondary hover:bg-secondary/10">
                  <Link href={`/copa-do-mundo?search=${encodeURIComponent(match.homeTeam)}`}>
                     <Tv className="w-3 h-3" /> Ver Onde Assistir
                  </Link>
               </Button>
             )}
          </div>
       </CardContent>
    </Card>
  );
}
