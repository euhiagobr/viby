
"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History, Target, Zap, Clock, MapPin, Building2, Ticket, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

interface UserSocialContentProps {
  profile: any;
  stats: any;
  activities: any[];
}

export function UserSocialContent({ profile, stats, activities }: UserSocialContentProps) {
  return (
    <div className="space-y-20">
      {/* 1. Interests & Stats Summary */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
         <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2">Interesses & Tags</h3>
            <div className="flex flex-wrap gap-2">
               {stats?.categoriesExplored?.map((cat: string) => (
                 <Badge key={cat} variant="secondary" className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-white shadow-sm border-2 border-secondary/5 text-secondary hover:bg-secondary hover:text-white transition-all">
                    {cat}
                 </Badge>
               )) || (
                 <p className="text-xs italic text-muted-foreground opacity-50 px-2">Nenhum interesse mapeado ainda.</p>
               )}
            </div>
         </div>
         <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2">Mapa de Calor</h3>
            <div className="grid grid-cols-2 gap-4">
               <SummaryCard label="Top Categoria" value={stats?.topCategory || "---"} icon={Zap} />
               <SummaryCard label="Top Local" value={stats?.topNeighborhood || "---"} icon={MapPin} />
            </div>
         </div>
      </section>

      {/* 2. Timeline of Activities */}
      <section className="space-y-8">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-primary/5 rounded-lg text-primary">
            <History className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Linha do Tempo</h2>
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
                    act.reason === 'on_checkin' ? "bg-green-500 text-white" : "bg-primary text-white"
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
             <div className="py-10 text-center opacity-30 italic text-sm">Nenhuma atividade recente registrada.</div>
           )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon }: { label: string, value: string, icon: any }) {
  return (
    <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-border/40 flex items-center gap-4">
       <div className="p-2.5 bg-muted rounded-xl text-primary"><Icon className="w-4 h-4" /></div>
       <div>
          <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">{label}</p>
          <p className="text-xs font-bold text-primary truncate max-w-[120px]">{value}</p>
       </div>
    </div>
  );
}

function getActivityLabel(act: any) {
  switch (act.reason) {
    case 'on_signup': return "Iniciou sua jornada na Viby";
    case 'on_checkin': return `Fez check-in em: ${act.context?.eventTitle || 'um evento'}`;
    case 'on_ticket_purchase': return `Garantiu presença para: ${act.context?.eventTitle || 'um evento'}`;
    case 'on_follow_org': return `Começou a seguir: ${act.context?.orgName || 'uma marca'}`;
    case 'on_follow_user': return `Seguiu o perfil de: ${act.context?.targetName || 'outro usuário'}`;
    default: return "Realizou uma atividade cultural";
  }
}
