
"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface RichTextProps {
  content: string
  className?: string
}

/**
 * Componente global para renderização de texto com suporte a:
 * - Negrito: **texto**
 * - Texto aumentado: +texto+ (aumento de ~30%)
 * - Menções: @username (link dinâmico)
 */
export function RichText({ content, className }: RichTextProps) {
  if (!content) return null

  // Regex combinada para capturar os padrões preservando a ordem
  // 1. Bold: \*\*(.*?)\*\*
  // 2. Mentions: @([a-zA-Z0-9._]+)
  // 3. Large: \+([^\+]+)\+
  const regex = /(\*\*.*?\*\*|@[\w.]+|\+.*?\+)/g
  const parts = content.split(regex)

  return (
    <div className={cn("whitespace-pre-line leading-relaxed", className)}>
      {parts.map((part, i) => {
        // Bold
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-black text-primary">
              {part.slice(2, -2)}
            </strong>
          )
        }
        
        // Mentions (ignora se for apenas @ ou se parecer um e-mail parcial)
        if (part.startsWith('@') && part.length > 1) {
          const username = part.slice(1).toLowerCase()
          return (
            <Link
              key={i}
              href={`/${username}`}
              className="text-secondary font-black hover:underline transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
          )
        }

        // Large Text
        if (part.startsWith('+') && part.endsWith('+') && part.length > 2) {
          // Filtra falsos positivos como +55 ou 2+2
          const inner = part.slice(1, -1)
          if (!/^\d+$/.test(inner) && inner.length > 1) {
            return (
              <span 
                key={i} 
                className="inline-block text-[1.3em] font-black uppercase italic tracking-tighter leading-tight align-middle my-0.5 text-primary"
              >
                {inner}
              </span>
            )
          }
        }

        return <React.Fragment key={i}>{part}</React.Fragment>
      })}
    </div>
  )
}
