"use client"

import * as React from 'react';
import useSWR from 'swr';
import { fetcher, WC_ENDPOINTS } from '@/lib/services/worldCupService';
import { FootballDataResponse, Standing, Match } from '@/types/worldcup';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Trophy, 
  Calendar, 
  RefreshCw,
  Loader2,
  AlertTriangle,
  Zap,
  Info
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GroupStageView } from '@/components/worldcup/GroupStageView';
import { KnockoutPhaseView } from '@/components/worldcup/KnockoutPhaseView';
import { BrazilStatusCard } from '@/components/worldcup/BrazilStatusCard';
import { cn } from '@/lib/utils';

const BRAZIL_ID = 764;

export default function TabelaClient() {
  const [activeTab, setActiveTab] = React.useState("groups");

  // Fetch Classificação
  const { data: standingsData, error: standingsError, mutate: mutateStandings, isLoading: loadingStandings } = useSWR<FootballDataResponse<Standing>>(
    WC_ENDPOINTS.standings, 
    fetcher,
    { refreshInterval: 15 * 60 * 1000, revalidateOnFocus: false }
  );

  // Fetch Jogos
  const { data: matchesData, error: matchesError, mutate: mutateMatches, isLoading: loadingMatches } = useSWR<FootballDataResponse<Match>>(
    WC_ENDPOINTS.matches, 
    fetcher,
    { refreshInterval: 5 * 60 * 1000, revalidateOnFocus: false }
  );

  const handleRetry = () => {
    mutateStandings();
    mutateMatches();
  };

  const brazilNextMatch = React.useMemo(() => {
    if (!matchesData?.matches) return null;
    return matchesData.matches.find(m => 
      (m.homeTeam?.id === BRAZIL_ID || m.awayTeam?.id === BRAZIL_ID) && 
      ['SCHEDULED', 'TIMED', 'IN_PLAY'].includes(m.status)
    );
  }, [matchesData]);

  const currentPhase = React.useMemo(() => {
    if (!matchesData?.matches) return 'GROUP_STAGE';
    const stages = matchesData.matches.map(m => m.stage);
    
    if (stages.includes('FINAL')) return 'FINAL';
    if (stages.includes('SEMI_FINALS')) return 'SEMI_FINALS';
    if (stages.includes('QUARTER_FINALS')) return 'QUARTER_FINALS';
    if (stages.includes('ROUND_OF_16')) return 'ROUND_OF_16';
    
    return 'GROUP_STAGE';
  }, [matchesData]);

  const isKnockout = currentPhase !== 'GROUP_STAGE';

  const groupedMatches = React.useMemo(() => {
    if (!matchesData?.matches) return { today: [], upcoming: [], finished: [], live: [] };
    
    const now = new Date();
    const live = matchesData.matches.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');
    const finished = [...matchesData.matches]
      .filter(m => m.status === 'FINISHED')
      .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime());
    
    const today = matchesData.matches.filter(m => 
      !['FINISHED', 'IN_PLAY', 'PAUSED'].includes(m.status) &&
      new Date(m.utcDate).toDateString() === now.toDateString()
    );

    const upcoming = matchesData.matches.filter(m => 
      ['SCHEDULED', 'TIMED'].includes(m.status) && 
      new Date(m.utcDate).toDateString() !== now.toDateString()
    ).sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());

    return { today, upcoming, finished, live };
  }, [matchesData]);

  if (standingsError || matchesError) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-6 text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-500 shadow-inner">
           <AlertTriangle className="w-10 h-10" />
        </div>
        <h3 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Não foi possível carregar os dados.</h3>
        <Button onClick={handleRetry} className="bg-primary text-white font-black rounded-2xl h-14 px-10 shadow-xl uppercase italic gap-2">
           <RefreshCw className="w-4 h-4" /> Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <section className="relative">
         <BrazilStatusCard 
           standings={standingsData?.standings} 
           nextMatch={brazilNextMatch} 
           loading={loadingMatches || loadingStandings}
         />
      </section>

      {groupedMatches.live.length > 0 && (
        <section className="space-y-6 animate-in slide-in-from-top-4">
           <div className="flex items-center gap-3 px-2">
              <div className="p-2 bg-red-500 rounded-lg text-white animate-pulse"><Zap className="w-5 h-5 fill-current" /></div>
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary">Jogos ao Vivo</h2>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groupedMatches.live.map(match => <MatchCard key={match.id} match={match} />)}
           </div>
        </section>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-10">
        <div className="flex justify-center">
           <TabsList className="bg-muted/50 p-1 rounded-2xl h-14 flex-wrap justify-center overflow-x-auto shadow-inner">
              <TabsTrigger value="groups" className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest gap-2">
                {isKnockout ? 'Chaveamento' : 'Classificação'}
              </TabsTrigger>
              <TabsTrigger value="matches" className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest gap-2">Calendário de Jogos</TabsTrigger>
           </TabsList>
        </div>

        <TabsContent value="groups" className="space-y-10">
           {isKnockout ? (
             <KnockoutPhaseView matches={matchesData?.matches} />
           ) : (
             <GroupStageView standings={standingsData?.standings} />
           )}
        </TabsContent>

        <TabsContent value="matches" className="space-y-12">
           {loadingMatches ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {Array.from({length: 6}).map((_, i) => <Loader2 key={i} className="h-40 w-full animate-spin text-muted" />)}
              </div>
           ) : (
             <>
               {groupedMatches.today.length > 0 && (
                 <section className="space-y-6">
                    <h3 className="text-xl font-black uppercase italic tracking-tighter text-secondary flex items-center gap-3 px-2">
                       <Zap className="w-5 h-5 fill-current" /> Jogos de Hoje
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {groupedMatches.today.map(match => <MatchCard key={match.id} match={match} />)}
                    </div>
                 </section>
               )}

               <section className="space-y-6">
                  <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary flex items-center gap-3 px-2">
                     <Calendar className="w-5 h-5 text-secondary" /> Próximas Partidas
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {groupedMatches.upcoming.slice(0, 20).map(match => <MatchCard key={match.id} match={match} />)}
                  </div>
               </section>
             </>
           )}
        </TabsContent>
      </Tabs>

      <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-start gap-4 max-w-2xl mx-auto shadow-sm">
         <Info className="w-6 h-6 text-secondary opacity-60" />
         <p className="text-[10px] text-muted-foreground font-bold uppercase leading-relaxed">
           Dados sincronizados em tempo real via Football Data API. Última verificação global: {new Date().toLocaleTimeString('pt-BR')}.
         </p>
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: Match }) {
  const isFinished = match.status === 'FINISHED';
  const isLive = ['IN_PLAY', 'PAUSED'].includes(match.status);
  const locationDisplay = match.venue || match.group?.replace('GROUP_', 'Grupo ') || match.stage?.replace('_', ' ') || "Estádio a definir";

  return (
    <Card className={cn(
      "border-none shadow-sm rounded-[2rem] bg-white overflow-hidden group hover:shadow-xl transition-all duration-300",
      isLive && "ring-2 ring-red-500 shadow-red-500/10"
    )}>
       <CardContent className="p-0">
          <div className="bg-muted/30 p-4 border-b flex justify-between items-center">
             <Badge variant="outline" className={cn(
               "text-[8px] font-black uppercase h-5 border-none",
               isLive ? "bg-red-500 text-white animate-pulse" : isFinished ? "bg-muted text-muted-foreground" : "bg-secondary/10 text-secondary"
             )}>
                {isLive ? 'AO VIVO' : isFinished ? 'ENCERRADO' : match.stage?.replace('_', ' ')}
             </Badge>
             <span className="text-[9px] font-bold text-muted-foreground uppercase">
                {new Date(match.utcDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} • {new Date(match.utcDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
             </span>
          </div>
          <div className="p-8 flex items-center justify-between gap-4">
             <div className="flex flex-col items-center gap-3 flex-1 min-w-0">
                <div className="h-10 w-12 bg-muted rounded overflow-hidden relative border shadow-sm">
                   {match.homeTeam && <img src={match.homeTeam.crest} alt="" className="object-cover w-full h-full" />}
                </div>
                <span className="font-black text-sm uppercase italic text-primary text-center leading-none truncate w-full">{match.homeTeam?.shortName || match.homeTeam?.name || 'TBD'}</span>
             </div>
             
             <div className="flex flex-col items-center gap-2 shrink-0">
                { (isFinished || isLive || (match.score?.fullTime?.home !== null)) ? (
                   <div className="text-3xl font-black italic tracking-tighter flex items-center gap-4 bg-primary text-white px-6 py-2 rounded-2xl shadow-lg">
                      <span>{match.score?.fullTime?.home ?? 0}</span>
                      <span className="opacity-20 text-sm">X</span>
                      <span>{match.score?.fullTime?.away ?? 0}</span>
                   </div>
                ) : (
                   <div className="text-[10px] font-black uppercase opacity-20 italic">VS</div>
                )}
             </div>

             <div className="flex flex-col items-center gap-3 flex-1 min-w-0">
                <div className="h-10 w-12 bg-muted rounded overflow-hidden relative border shadow-sm">
                   {match.awayTeam && <img src={match.awayTeam.crest} alt="" className="object-cover w-full h-full" />}
                </div>
                <span className="font-black text-sm uppercase italic text-primary text-center leading-none truncate w-full">{match.awayTeam?.shortName || match.awayTeam?.name || 'TBD'}</span>
             </div>
          </div>
       </CardContent>
    </Card>
  );
}
