"use client"

import * as React from "react"
import { Eye, Heart, Users, Share2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface EventStatsProps {
  views: number
  interested: number
  going: number
  shares: number
  className?: string
}

export function EventStats({ views, interested, going, shares, className }: EventStatsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-6", className)}>
       <StatItem icon={Eye} label="Views" value={views} />
       <StatItem icon={Heart} label="Interesse" value={interested} />
       <StatItem icon={Users} label="Confirmados" value={going} />
       <StatItem icon={Share2} label="Shares" value={shares} />
    </div>
  )
}

function StatItem({ icon: Icon, label, value }: { icon: any, label: string, value: number }) {
  return (
    <div className="flex items-center gap-2">
       <div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><Icon className="w-3.5 h-3.5" /></div>
       <div className="flex flex-col">
          <span className="text-xs font-black text-primary leading-none">{value >= 1000 ? `${(value/1000).toFixed(1)}k` : value}</span>
          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tight">{label}</span>
       </div>
    </div>
  )
}
