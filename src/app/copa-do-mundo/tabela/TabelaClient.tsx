
'use client';

import * as React from 'react';
import useSWR from 'swr';
import { fetcher, WC_ENDPOINTS } from '@/lib/services/worldCupService';
import { FootballDataResponse, Standing, Match, TableEntry } from '@/types/worldcup';
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
  History as HistoryIcon,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Zap
} from 'lucide-react';
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const BRAZIL_ID = 764;

export default function TabelaClient() {
  const [activeTab, setActiveTab] = React.useState("groups");

  // Fetch Classificação (Cache 15 min)
  const { data: standingsData, error: standingsError, mutate: mutateStandings } = useSWR<FootballDataResponse<Standing>>(
    WC_ENDPOINTS.standings, 
    fetcher,
    { refreshInterval: 15 * 60 * 1000 }
  );

  // Fetch Jogos (Cache 5 min)
  const { data: matchesData, error: matchesError, mutate: mutateMatches } = useSWR<FootballDataResponse<Match>>(
    WC_ENDPOINTS.matches, 
    fetcher,
    { refreshInterval: 5 * 60 * 1000 }
  );

  const handleRetry = () => {
    mutateStandings();
    mutateMatches();
  };

  const brazilStats = React.useMemo(() => {
    if (!standingsData?.standings) return null;
    for (const standing of standingsData.standings) {
      const entry = standing.table.find(t => t.team.id === BRAZIL_ID);
      if (entry) return { entry, group: standing.group?.replace('GROUP_', '') };
    }
    return null;
  }, [standingsData]);

  const brazilNextMatch = React.useMemo(() => {
    if (!matchesData?.matches) return null;
    return matchesData.matches.find(m => 
      (m.homeTeam.id === BRAZIL_ID || m.awayTeam.id === BRAZIL_ID) && 
      (m.status === 'SCHEDULED' || m.status === 'TIMED' || m.status === 'IN_PLAY')
    );
  }, [matchesData]);

  const liveMatches = React.useMemo(() => {
    return matchesData?.matches?.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED') || [];
  }, [matchesData]);

  const finishedMatches = React.useMemo(() => {
    return matchesData?.matches?.filter(m => m.status === 'FINISHED') || [];
  }, [matchesData]);

  const upcomingMatches = React.useMemo(() => {
    return matchesData?.matches?.filter(m => m.status === 'SCHEDULED' || m.status === 'TIMED') || [];
  }, [matchesData]);

  if (standingsError || matchesError) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-6 text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-500">
           <AlertTriangle className="w-10 h-10" />
        </div>
        <div className="space-y-2">
           <h3 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Conexão Falhou</h3>
           <p className="text-muted-foreground font-medium max-w-sm mx-auto">Não foi possível carregar os dados da Copa do Mundo via API.</p>
        </div>
        <Button onClick={handleRetry} className="bg-primary text-white font-black rounded-xl h-12 px-8 uppercase italic gap-2">
           <RefreshCw className="w-4 h-4" /> Tentar Novamente
        </Button>
      </div>
    );
  }

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
                     <p className="text-[10px] font-black uppercase opacity-40 tracking-widest flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5" /> Classificação Grupo {brazilStats?.group || '---'}</p>
                     <div className="space-y-2">
                        {!standingsData ? <Skeleton className="h-10 w-32 bg-white/10" /> : (
                          <div className="flex justify-between items-end">
                             <span className="text-3xl font-black">{brazilStats?.entry.points || 0} pts</span>
                             <span className="text-xs font-bold opacity-60">Posição: {brazilStats?.entry.position}º</span>
                          </div>
                        )}
                        <div className="flex gap-2">
                           {Array.from({length: 3}).map((_, i) => (
                             <div key={i} className={cn("w-2 h-2 rounded-full", (brazilStats?.entry.won && i < brazilStats.entry.won) ? "bg-[#009c3b]" : "bg-white/20")} />
                           ))}
                        </div>
                     </div>
                  </div>

                  <div className="space-y-4">
                     <p className="text-[10px] font-black uppercase opacity-40 tracking-widest flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Próximo Jogo</p>
                     {!matchesData ? <div className="space-y-2"><Skeleton className="h-4 w-40 bg-white/10" /><Skeleton className="h-3 w-32 bg-white/10" /></div> : brazilNextMatch ? (
                       <div className="space-y-1">
                          <p className="font-black text-sm uppercase italic text-[#ffdf00]">vs {brazilNextMatch.homeTeam.id === BRAZIL_ID ? brazilNextMatch.awayTeam.name : brazilNextMatch.homeTeam.name}</p>
                          <p className="text-xs font-bold">{new Date(brazilNextMatch.utcDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} • {new Date(brazilNextMatch.utcDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                       </div>
                     ) : <p className="text-xs opacity-60 uppercase font-black">Aguardando definição</p>}
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

      {/* AO VIVO */}
      {liveMatches.length > 0 && (
        <section className="space-y-6">
           <div className="flex items-center gap-3 px-2">
              <div className="p-2 bg-red-500 rounded-lg text-white animate-pulse"><Zap className="w-5 h-5 fill-current" /></div>
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary">Jogos ao Vivo</h2>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {liveMatches.map(match => <MatchCard key={match.id} match={match} />)}
           </div>
        </section>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-10">
        <div className="flex justify-center">
           <TabsList className="bg-muted/50 p-1 rounded-2xl h-14 flex-wrap justify-center overflow-x-auto">
              <TabsTrigger value="groups" className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest gap-2">Classificação</TabsTrigger>
              <TabsTrigger value="matches" className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest gap-2">Tabela de Jogos</TabsTrigger>
           </TabsList>
        </div>

        <TabsContent value="groups" className="space-y-10">
           {!standingsData ? (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {Array.from({length: 4}).map((_, i) => <Skeleton key={i} className="h-80 w-full rounded-[2rem]" />)}
             </div>
           ) : (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {standingsData.standings?.map((group) => (
                  <Card key={group.group} className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
                     <CardHeader className="bg-muted/30 border-b p-6">
                        <CardTitle className="text-lg font-black italic uppercase tracking-tighter text-primary">Grupo {group.group?.replace('GROUP_', '')}</CardTitle>
                     </CardHeader>
                     <CardContent className="p-0 overflow-x-auto">
                        <table className="w-full text-left min-w-[400px]">
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
                              {group.table.map((entry, idx) => (
                                <tr key={entry.team.id} className={cn("hover:bg-muted/5", entry.team.id === BRAZIL_ID && "bg-green-50/20")}>
                                   <td className="px-6 py-4 flex items-center gap-3">
                                      <span className="text-[10px] font-bold opacity-30 w-3">{entry.position}</span>
                                      <div className="h-6 w-8 bg-muted rounded overflow-hidden relative border">
                                         <img src={entry.team.crest} alt="" className="object-cover w-full h-full" />
                                      </div>
                                      <span className="font-bold text-xs uppercase text-primary truncate max-w-[120px]">{entry.team.name}</span>
                                   </td>
                                   <td className="px-2 py-4 text-center font-black text-xs">{entry.points}</td>
                                   <td className="px-2 py-4 text-center text-xs opacity-60 font-bold">{entry.playedGames}</td>
                                   <td className="px-2 py-4 text-center text-xs opacity-60 font-bold">{entry.won}</td>
                                   <td className="px-2 py-4 text-center text-xs font-black text-secondary">{entry.goalDifference}</td>
                                </tr>
                              ))}
                           </tbody>
                        </table>
                     </CardContent>
                  </Card>
                ))}
             </div>
           )}
        </TabsContent>

        <TabsContent value="matches" className="space-y-12">
           {!matchesData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {Array.from({length: 6}).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
              </div>
           ) : (
             <>
               <section className="space-y-6">
                  <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary flex items-center gap-3 px-2">
                     <Calendar className="w-5 h-5 text-secondary" /> Próximas Partidas
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {upcomingMatches.length > 0 ? upcomingMatches.slice(0, 16).map(match => (
                       <MatchCard key={match.id} match={match} />
                     )) : (
                       <div className="col-span-full py-20 text-center opacity-30 italic text-sm uppercase font-bold bg-white rounded-3xl border-2 border-dashed">
                         Carregando calendário oficial...
                       </div>
                     )}
                  </div>
               </section>

               <section className="space-y-6">
                  <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary flex items-center gap-3 px-2 opacity-60">
                     <HistoryIcon className="w-5 h-5" /> Resultados Recentes
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {finishedMatches.slice(0, 10).map(match => <MatchCard key={match.id} match={match} />)}
                  </div>
               </section>
             </>
           )}
        </TabsContent>
      </Tabs>

      <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-start gap-4 max-w-2xl mx-auto">
         <span className="shrink-0 mt-0.5"><Info className="w-6 h-6 text-secondary" /></span>
         <div className="space-y-1">
            <h4 className="font-black uppercase text-[10px] tracking-widest text-secondary">Dados Reais e Oficiais</h4>
            <p className="text-[10px] text-muted-foreground font-bold uppercase leading-relaxed">
               As informações são atualizadas em tempo real via Football-Data.org. 
               {standingsData && ` Última sincronização global: ${new Date().toLocaleTimeString('pt-BR')}.`}
            </p>
         </div>
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: Match }) {
  const isFinished = match.status === 'FINISHED';
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';

  return (
    <Card className={cn(
      "border-none shadow-sm rounded-[2rem] bg-white overflow-hidden group hover:shadow-xl transition-all",
      isLive && "ring-2 ring-red-500"
    )}>
       <CardContent className="p-0">
          <div className="bg-muted/30 p-4 border-b flex justify-between items-center">
             <Badge variant="outline" className={cn(
               "text-[8px] font-black uppercase h-5",
               isLive ? "bg-red-500 text-white border-none" : "border-secondary/20 text-secondary"
             )}>
                {isLive ? 'AO VIVO' : match.stage?.replace('_', ' ')}
             </Badge>
             <span className="text-[9px] font-bold text-muted-foreground uppercase">
                {new Date(match.utcDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} • {new Date(match.utcDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
             </span>
          </div>
          <div className="p-8 flex items-center justify-between gap-4">
             <div className="flex flex-col items-center gap-3 flex-1">
                <div className="h-10 w-12 bg-muted rounded overflow-hidden relative border">
                   <img src={match.homeTeam.crest} alt="" className="object-cover w-full h-full" />
                </div>
                <span className="font-black text-sm uppercase italic text-primary text-center leading-none">{match.homeTeam.shortName || match.homeTeam.name}</span>
             </div>
             
             <div className="flex flex-col items-center gap-2 shrink-0">
                { (isFinished || isLive) ? (
                   <div className="text-3xl font-black italic tracking-tighter flex items-center gap-4 bg-primary text-white px-6 py-2 rounded-2xl shadow-lg">
                      <span>{match.score.fullTime.home ?? 0}</span>
                      <span className="opacity-20 text-sm">X</span>
                      <span>{match.score.fullTime.away ?? 0}</span>
                   </div>
                ) : (
                   <div className="text-xs font-black uppercase opacity-20 italic">VS</div>
                )}
             </div>

             <div className="flex flex-col items-center gap-3 flex-1">
                <div className="h-10 w-12 bg-muted rounded overflow-hidden relative border">
                   <img src={match.awayTeam.crest} alt="" className="object-cover w-full h-full" />
                </div>
                <span className="font-black text-sm uppercase italic text-primary text-center leading-none">{match.awayTeam.shortName || match.awayTeam.name}</span>
             </div>
          </div>
          <div className="p-4 border-t border-dashed bg-muted/5 flex flex-col sm:flex-row items-center justify-between gap-4">
             <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase truncate">
                <MapPin className="w-3.5 h-3.5" /> {match.venue || "Estádio a definir"}
             </div>
             {!isFinished && (
               <Button asChild variant="ghost" size="sm" className="h-8 rounded-xl font-black uppercase italic text-[9px] gap-2 text-secondary hover:bg-secondary/10">
                  <Link href={`/copa-do-mundo?search=${encodeURIComponent(match.homeTeam.name)}`}>
                     <Tv className="w-3 h-3" /> Onde Assistir
                  </Link>
               </Button>
             )}
          </div>
       </CardContent>
    </Card>
  );
}
