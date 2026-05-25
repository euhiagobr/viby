
"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export function EventDescription({ description }: { description: string }) {
  // Simples higienização visual: garantir que links e menções fiquem destacados
  const renderFormattedText = (text: string) => {
    if (!text) return "";
    return text.split(/(\*\*.*?\*\*|@\w+)/g).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-black text-foreground">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('@')) {
        return <span key={i} className="text-secondary font-black">{part}</span>;
      }
      return part;
    });
  };

  return (
    <div className="space-y-8">
      <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 px-1">Sobre a experiência</h2>
      <div className="prose prose-neutral max-w-none">
        <p className="text-muted-foreground leading-relaxed text-lg whitespace-pre-line font-medium selection:bg-secondary/20">
          {renderFormattedText(description)}
        </p>
      </div>
    </div>
  )
}
