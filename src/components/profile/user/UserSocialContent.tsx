
"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, Zap, Clock, MapPin, Building2, Ticket, CheckCircle2, Lock, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface UserSocialContentProps {
  profile: any;
  stats: any;
  activities: any[];
  isOwner?: boolean;
}

export function UserSocialContent({ profile, stats, activities, isOwner = false }: UserSocialContentProps) {
  const showStats = isOwner || !profile.privacy?.hideStats;

  return (
    <div className="space-y-20">
      {/* 1. Interests & Stats Summary */}
      {showStats ? (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
           <div className="space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2">Interesses Culturais</h3>
              <div className="flex flex-wrap gap-2">
                 {stats?.categoriesExplored?.length > 0 ? stats.categoriesExplored.map((cat: string) => (
                   <Badge key={cat} variant="secondary" className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-white shadow-sm border-2 border-secondary/5 text-secondary">
                      {cat}
                   </Badge>
                 )) : (
                   <p className="text-xs italic text-muted-foreground opacity-50 px-2 uppercase font-bold">Nenhum interesse mapeado.</p>
                 )}
              </div>
           </div>
           <div className="space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2">Estatísticas</h3>
              <div className="grid grid-cols-2 gap-4">
                 <SummaryCard label="Gênero Favorito" value={stats?.topCategory || "---"} icon={Zap} />
                 {isOwner || !profile.privacy?.hideLocation ? (
                   <SummaryCard label="Top Local" value={stats?.topNeighborhood || "---"} icon={MapPin} />
                 ) : (
                   <div className="bg-muted/30 p-6 rounded-[1.5rem] border border-dashed flex items-center justify-center text-center">
                      <p className="text-[8px] font-black uppercase text-muted-foreground/40">Localização Privada</p>
                   </div>
                 )}
              </div>
           </div>
        </section>
      ) : (
        <Card className="border-none shadow-sm rounded-[2rem] bg-white p-12 text-center flex flex-col items-center gap-4">
           <Lock className="w-8 h-8 text-muted-foreground opacity-20" />
           <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">As estatísticas deste perfil são privadas</p>
        </Card>
      )}

      {/* 2. Timeline of Activities - STRICTLY PRIVATE */}
      {(isOwner || !profile.privacy?.hideStats) ? (
        <section className="space-y-8 animate-in fade-in duration-500">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/5 rounded-lg text-primary">
                <History className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Linha do Tempo</h2>
            </div>
            {isOwner && (
              <Badge variant="outline" className="text-[8px] font-black uppercase border-orange-200 text-orange-600 gap-1.5 h-6">
                <EyeOff className="w-3 h-3" /> Visível apenas para você
              </Badge>
            )}
          </div>

          <div className="relative pl-8 space-y-12 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-border/60 before:border-dashed before:border-l">
             {activities && activities.length > 0 ? (
               activities.map((act, i) => (
                 <motion.div 
                   key={act.id} 
                   initial={{ opacity: 0, x: -10 }}
                   whileInView={{ opacity: 1, x: 0 }}
                   transition={{ delay: i * 0.1 }}
                   className="relative group"
                 >
                    <div className={cn(
                      "absolute -left-8 top-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-background shadow-lg transition-transform group-hover:scale-125 z-10",
                      act.reason === 'on_checkin' ? "bg-green-500 text-white" : 
                      act.reason === 'on_ticket_purchase' ? "bg-secondary text-white" : "bg-primary text-white"
                    )}>
                       {act.reason === 'on_checkin' ? <CheckCircle2 className="w-3 h-3" /> : 
                        act.reason === 'on_ticket_purchase' ? <Ticket className="w-3 h-3" /> :
                        <Clock className="w-3 h-3" />}
                    </div>
                    <div className="space-y-1">
                       <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          {new Date(act.timestamp?.seconds * 1000 || act.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                       </p>
                       <div className="bg-white p-5 rounded-3xl shadow-sm border border-border/40 group-hover:border-secondary/20 transition-all">
                          <p className="text-sm font-bold text-primary">
                             {getActivityLabel(act)}
                          </p>
                          {act.context?.orgName && (
                            <p className="text-[10px] font-black uppercase text-secondary mt-1 flex items-center gap-1.5">
                               <Building2 className="w-3 h-3" /> {act.context.orgName}
                            </p>
                          )}
                       </div>
                    </div>
                 </motion.div>
               ))
             ) : (
               <div className="py-10 text-center opacity-30 italic text-sm uppercase font-bold">Nenhuma atividade recente registrada.</div>
             )}
          </div>
        </section>
      ) : (
        <div className="p-12 border-2 border-dashed border-border/60 rounded-[3rem] text-center flex flex-col items-center gap-4 bg-muted/10">
           <History className="w-10 h-10 text-muted-foreground opacity-20" />
           <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">O feed de atividades é privado</p>
              <p className="text-[9px] text-muted-foreground font-medium uppercase max-w-[200px] mx-auto opacity-60">Em conformidade com a LGPD, os hábitos de consumo cultural não são expostos publicamente.</p>
           </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon }: { label: string, value: string, icon: any }) {
  return (
    <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-border/40 flex items-center gap-4">
       <div className="p-2.5 bg-muted rounded-xl text-primary"><Icon className="w-4 h-4" /></div>
       <div className="min-w-0">
          <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">{label}</p>
          <p className="text-xs font-black text-primary truncate uppercase">{value}</p>
       </div>
    </div>
  );
}

function getActivityLabel(act: any) {
  switch (act.reason) {
    case 'on_signup': return "Iniciou sua jornada na Viby";
    case 'on_checkin': return `Fez check-in em: ${act.context?.eventTitle || 'um evento'}`;
    case 'on_ticket_purchase': return `Garantiu presença para: ${act.context?.eventTitle || 'um evento'}`;
    case 'on_follow_org': return `Começou a seguir: ${act.context?.orgName || act.context?.targetName || 'uma marca'}`;
    case 'on_follow_user': return `Seguiu o perfil de: ${act.context?.targetName || 'outro usuário'}`;
    default: return "Realizou uma atividade cultural";
  }
}
