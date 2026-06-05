
"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Megaphone } from "lucide-react"

interface GoogleAdProps {
  publisherId: string
  slotId: string
  format?: 'auto' | 'fluid' | 'rectangle'
  responsive?: boolean
  className?: string
}

/**
 * Renderizador de Bloco AdSense compatível com o Design System da Viby.
 * Mantém o layout shift mínimo reservando altura e utilizando cards padrão.
 */
export function GoogleAd({ publisherId, slotId, format = 'auto', responsive = true, className }: GoogleAdProps) {
  React.useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      // Silently ignore if already loaded or blocked
    }
  }, []);

  return (
    <Card className={`group overflow-hidden border-none shadow-lg bg-card rounded-[2rem] relative p-6 flex flex-col justify-center min-h-[280px] transition-all hover:shadow-xl ${className}`}>
      {/* Selo Discreto de Publicidade conforme regra 7 */}
      <div className="absolute top-4 right-4 z-20">
        <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-none font-black text-[9px] uppercase px-3 py-1 flex items-center gap-1.5 opacity-60">
          Publicidade
        </Badge>
      </div>
      
      {/* Container do AdSense */}
      <div className="w-full h-full flex items-center justify-center overflow-hidden rounded-xl">
        <ins 
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', minHeight: '200px' }}
          data-ad-client={publisherId}
          data-ad-slot={slotId}
          data-ad-format={format}
          data-full-width-responsive={responsive ? 'true' : 'false'}
        />
      </div>
      
      {/* Rodapé do Ad conforme Design System */}
      <div className="mt-4 flex items-center gap-2 opacity-20 select-none">
         <Megaphone className="w-3 h-3" />
         <span className="text-[8px] font-black uppercase tracking-widest">Google Ads Managed</span>
      </div>
    </Card>
  )
}
