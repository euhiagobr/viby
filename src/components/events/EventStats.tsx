
"use client"

import * as React from "react"
import { Eye, Heart, Users, Share2, Lock as LockIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EventStatsProps {
  views: number
  interested: number
  going: number
  shares: number
  isOwner?: boolean
  className?: string
}

export function EventStats({ views, interested, going, shares, isOwner, className }: EventStatsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-6", className)}>
       {/* Visualizações: Apenas proprietário */}
       {isOwner ? (
         <StatItem icon={Eye} label="Views" value={views} />
       ) : (
         <div className="flex items-center gap-2 opacity-30 cursor-help" title="Visualizações visíveis apenas para o organizador">
            <div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><LockIcon className="w-3 h-3" /></div>
            <div className="flex flex-col">
               <span className="text-xs font-black text-primary leading-none">***</span>
               <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tight">Views</span>
            </div>
         </div>
       )}

       <StatItem icon={Heart} label="Interesse" value={interested} />
       <StatItem icon={Share2} label="Shares" value={shares} />
    </div>
  )
}

function StatItem({ icon: Icon, label, value }: { icon: any, label: string, value: number }) {
  return (
    <div className="flex items-center gap-2">
       <div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><Icon className="w-3.5 h-3.5" /></div>
       <div className="flex flex-col">
          <span className="text-xs font-black text-primary leading-none">
            {value >= 1000 ? `${(value/1000).toFixed(1)}k`.replace('.0', '') : value}
          </span>
          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tight">{label}</span>
       </div>
    </div>
  )
}
