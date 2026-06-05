"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Zap, Star, Award, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { calculateLevel, DEFAULT_LEVELS } from "@/lib/gamification";

interface UserGamificationProps {
  gamification: any;
}

export function UserGamification({ gamification }: UserGamificationProps) {
  const currentXp = gamification?.totalXp || 0;
  const { current, next, progress } = calculateLevel(currentXp, DEFAULT_LEVELS);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 px-2">
        <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
          <Trophy className="w-5 h-5" />
        </div>
        <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Jornada Cultural</h2>
      </div>

      <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden p-1">
         <div className="grid grid-cols-1 md:grid-cols-12 gap-0">
            {/* Level Card */}
            <div className="md:col-span-4 bg-primary p-10 text-white flex flex-col items-center justify-center text-center gap-6 rounded-[2.3rem] relative overflow-hidden">
               <div className="relative z-10 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Nível Atual</p>
                  <div className="text-8xl font-black italic tracking-tighter">{current.level}</div>
                  <Badge variant="outline" className="border-secondary text-secondary font-black uppercase italic px-4 py-1 text-[10px] tracking-widest bg-secondary/10">{current.name}</Badge>
               </div>
               <p className="text-xs font-medium opacity-60 max-w-[150px] relative z-10">{current.description}</p>
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl" />
            </div>

            {/* XP Progress */}
            <div className="md:col-span-8 p-10 flex flex-col justify-center gap-8">
               <div className="space-y-4">
                  <div className="flex justify-between items-end">
                     <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Progresso de Experiência</p>
                        <p className="text-xl font-black text-primary italic uppercase tracking-tighter">
                           {currentXp.toLocaleString()} XP
                        </p>
                     </div>
                     <div className="text-right space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Próximo: {next?.name || "Lenda"}</p>
                        <p className="text-xs font-bold text-secondary">{next ? `${(next.xpRequired - currentXp).toLocaleString()} XP para o Lv. ${next.level}` : "Nível Máximo Alcançado"}</p>
                     </div>
                  </div>
                  
                  <div className="relative pt-2">
                     <div className="h-4 w-full bg-muted rounded-full overflow-hidden p-1 shadow-inner">
                        <motion.div 
                           initial={{ width: 0 }}
                           animate={{ width: `${progress}%` }}
                           transition={{ duration: 1.5, ease: "easeOut" }}
                           className="h-full bg-secondary rounded-full shadow-lg relative"
                        >
                           <div className="absolute inset-0 bg-white/20 animate-pulse" />
                        </motion.div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </Card>
    </div>
  );
}
