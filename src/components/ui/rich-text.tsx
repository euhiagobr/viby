
"use client"

import * as React from "react"
import Link from "next/link"
import { Instagram } from "lucide-react"
import { cn } from "@/lib/utils"

interface RichTextProps {
  content: string
  className?: string
}

/**
 * Viby Shortcode Engine
 * Converte marcações em componentes visuais.
 * Suporta: 
 * - **negrito**
 * - @menção
 * - ++texto grande++
 * - [instagramx=user]
 * - [imgx=url WxH]
 * - Siglas de Orgulho (LGBT, LGBTQIA+, etc) -> Link para /lgbt com estilo arco-íris
 */
export function RichText({ content, className }: RichTextProps) {
  if (!content) return null

  // Definição das siglas de orgulho para o Regex
  const pridePattern = "\\b(LGBTQIAPN\\+?|LGBTQIA\\+?|LGBTQ\\+?|LGBTI|LGBT)\\b";
  const prideRegex = new RegExp(`^${pridePattern}$`, 'i');

  // Regex consolidado para capturar todos os padrões
  const regex = new RegExp(`(\\*\\*.*?\\*\\*|@[\\w.]+|\\+\\+.*?\\+\\+|\\[instagramx=[\\w.]+\\]|\\[imgx=https?:\\/\\/[^\\s\\]]+(?:\\s+\\d+x\\d+)?\\]|${pridePattern})`, 'gi');
  
  const parts = content.split(regex)

  return (
    <div className={cn("whitespace-pre-line leading-relaxed", className)}>
      {parts.map((part, i) => {
        if (!part) return null;

        // 1. Negrito: **texto**
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-black text-primary">
              {part.slice(2, -2)}
            </strong>
          )
        }
        
        // 2. Menções: @username
        if (part.startsWith('@') && part.length > 1 && !part.includes('[') && !part.includes(']')) {
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

        // 3. Texto Grande: ++texto++
        if (part.startsWith('++') && part.endsWith('++') && part.length > 4) {
          const inner = part.slice(2, -2)
          return (
            <span 
              key={i} 
              className="inline-block text-[1.3em] font-black uppercase italic tracking-tighter leading-tight align-middle my-0.5 text-primary"
            >
              {inner}
            </span>
          )
        }

        // 4. Instagram: [instagramx=username]
        if (part.startsWith('[instagramx=')) {
          const username = part.match(/\[instagramx=([\w.]+)\]/)?.[1]
          if (username) {
            return (
              <a
                key={i}
                href={`https://instagram.com/${username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-muted/50 px-3 py-1 rounded-full text-secondary font-black text-xs hover:bg-secondary hover:text-white transition-all my-1 align-middle border border-secondary/10"
                onClick={(e) => e.stopPropagation()}
              >
                <Instagram className="w-3.5 h-3.5" />
                @{username}
              </a>
            )
          }
        }

        // 5. Imagem: [imgx=url 500x500]
        if (part.startsWith('[imgx=')) {
          const match = part.match(/\[imgx=(https?:\/\/[^\s\]]+)(?:\s+(\d+)x(\d+))?\]/)
          const url = match?.[1]
          const width = match?.[2] || "800"
          const height = match?.[3] || "600"

          if (url) {
            return (
              <VibyEmbeddedImage 
                key={i} 
                src={url} 
                width={parseInt(width)} 
                height={parseInt(height)} 
              />
            )
          }
        }

        // 6. Siglas de Orgulho: LGBT, LGBTQIA+, etc.
        if (prideRegex.test(part)) {
          return (
            <Link
              key={i}
              href="/lgbt"
              className="bg-gradient-to-r from-red-500 via-orange-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 bg-clip-text text-transparent font-bold hover:opacity-80 transition-opacity decoration-secondary/30"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
          )
        }

        return <React.Fragment key={i}>{part}</React.Fragment>
      })}
    </div>
  )
}

/**
 * Componente interno para tratamento de imagens embutidas
 */
function VibyEmbeddedImage({ src, width, height }: { src: string, width: number, height: number }) {
  const [error, setError] = React.useState(false)

  if (error) return null

  return (
    <div 
      className="my-6 relative overflow-hidden rounded-[2rem] bg-muted shadow-lg border border-border/40 group"
      style={{ 
        maxWidth: '100%', 
        width: width > 0 ? `${width}px` : '100%',
        aspectRatio: `${width}/${height}`
      }}
    >
      <img
        src={src}
        alt="Viby Content"
        loading="lazy"
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        onError={() => setError(true)}
      />
    </div>
  )
}
