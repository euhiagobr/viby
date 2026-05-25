"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface EventDescriptionProps {
  description: string
}

export function EventDescription({ description }: EventDescriptionProps) {
  const renderFormattedText = (text: string) => {
    if (!text) return ""

    // Divide o texto para processar parágrafos primeiro
    const paragraphs = text.split(/\n/g)

    return paragraphs.map((paragraph, pIdx) => {
      if (!paragraph.trim()) return <br key={`br-${pIdx}`} />

      // Processa estilos dentro do parágrafo: **negrito**, +grande+, @menção
      const parts = paragraph.split(/(\*\*.*?\*\*|\+.*?\+|@[\w.]+)/g)

      return (
        <p key={`p-${pIdx}`} className="mb-4 last:mb-0 leading-relaxed text-foreground/80">
          {parts.map((part, i) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return (
                <strong key={i} className="font-black text-foreground">
                  {part.slice(2, -2)}
                </strong>
              )
            }
            if (part.startsWith("+") && part.endsWith("+")) {
              return (
                <span key={i} className="text-2xl md:text-3xl font-black text-primary block my-2 leading-tight uppercase italic tracking-tighter">
                  {part.slice(1, -1)}
                </span>
              )
            }
            if (part.startsWith("@")) {
              const username = part.slice(1).toLowerCase()
              return (
                <Link
                  key={i}
                  href={`/${username}`}
                  className="text-secondary font-black hover:underline transition-all"
                >
                  {part}
                </Link>
              )
            }
            return part
          })}
        </p>
      )
    })
  }

  return (
    <section id="sobre" className="space-y-6">
      <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-1">
        Sobre o Evento
      </h2>
      <div className="max-w-none text-base md:text-lg">
        {renderFormattedText(description)}
      </div>
    </section>
  )
}
