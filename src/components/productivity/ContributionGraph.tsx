"use client"

import * as React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function ContributionGraph() {
  // Generate mock data for the last 52 weeks
  const weeks = 20
  const daysPerWeek = 7
  const totalDays = weeks * daysPerWeek

  const data = Array.from({ length: totalDays }, (_, i) => ({
    count: Math.floor(Math.random() * 5),
    date: new Date(Date.now() - (totalDays - i) * 86400000).toLocaleDateString('pt-BR'),
  }))

  const getColor = (count: number) => {
    if (count === 0) return "bg-muted"
    if (count === 1) return "bg-secondary/20"
    if (count === 2) return "bg-secondary/40"
    if (count === 3) return "bg-secondary/70"
    return "bg-secondary"
  }

  return (
    <div className="p-6 bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">Engajamento Semanal</h3>
      <div className="flex gap-1">
        {Array.from({ length: weeks }).map((_, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {Array.from({ length: daysPerWeek }).map((_, dayIndex) => {
              const item = data[weekIndex * daysPerWeek + dayIndex]
              if (!item) return null
              return (
                <TooltipProvider key={dayIndex}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={`w-3 h-3 rounded-sm ${getColor(item.count)} hover:ring-1 hover:ring-foreground transition-all cursor-pointer`}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{item.count} atividades em {item.date}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2 mt-4 text-[10px] text-muted-foreground">
        <span>Menos</span>
        <div className="w-2 h-2 rounded-sm bg-muted" />
        <div className="w-2 h-2 rounded-sm bg-secondary/20" />
        <div className="w-2 h-2 rounded-sm bg-secondary/40" />
        <div className="w-2 h-2 rounded-sm bg-secondary/70" />
        <div className="w-2 h-2 rounded-sm bg-secondary" />
        <span>Mais</span>
      </div>
    </div>
  )
}
