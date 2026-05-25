
"use client"

import * as React from "react"
import Link from "next/link"
import { Info } from "lucide-react"

interface EventDescriptionProps {
  description: string
}

export function EventDescription({ description }: EventDescriptionProps) {
  const renderFormattedText = (text: string) => {
    if (!text) return "";
    
    // Suporte a negrito: **texto**
    // Suporte a texto grande: +texto+
    // Suporte a menção: @username
    const parts = text.split(/(\*\*.*?\*\*|\+.*?\+|@[\w.]+)/g);

    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-black text-primary">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('+') && part.endsWith('+')) {
        return <span key={i} className="text-[1.3em] font-black leading-tight inline-block text-primary">{part.slice(1, -1)}</span>;
      }
      if (part.startsWith('@')) {
        const usernameMention = part.slice(1).toLowerCase();
        return (
          <Link 
            key={i} 
            href={`/${usernameMention}`} 
            className="text-secondary font-black hover:underline underline-offset-4"
          >
            {part}
          </Link>
        );
      }
      return part;
    });
  }

  return (
    <section className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-6 bg-secondary rounded-full" />
        <h2 className="text-2xl font-black uppercase italic tracking-tighter">Sobre o Evento</h2>
      </div>

      <div className="prose prose-slate max-w-none">
        <p className="text-base md:text-lg text-muted-foreground font-medium leading-relaxed whitespace-pre-line selection:bg-secondary/10">
          {renderFormattedText(description)}
        </p>
      </div>

      <div className="bg-primary/5 p-6 rounded-[2rem] border border-dashed border-primary/10 flex items-start gap-4">
        <Info className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
        <div className="space-y-1">
           <p className="text-[10px] font-black uppercase tracking-widest text-primary">Classificação e Regras</p>
           <p className="text-xs text-muted-foreground font-medium leading-relaxed">
             Este evento é organizado de forma independente. Verifique a classificação indicativa e as políticas de cancelamento do produtor antes de adquirir seu ingresso.
           </p>
        </div>
      </div>
    </section>
  )
}
