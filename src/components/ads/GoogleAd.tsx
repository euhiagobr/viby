
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

export function GoogleAd({ publisherId, slotId, format = 'auto', responsive = true, className }: GoogleAdProps) {
  React.useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error("[AdSense] Error pushing ad unit", e);
    }
  }, []);

  return (
    <Card className={`group overflow-hidden border-none shadow-lg bg-card rounded-[2rem] relative p-6 flex flex-col justify-center min-h-[250px] ${className}`}>
      <div className="absolute top-4 right-4 z-20">
        <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-none font-black text-[9px] uppercase px-3 py-1 flex items-center gap-1.5 opacity-60">
          Publicidade
        </Badge>
      </div>
      
      <div className="w-full h-full flex items-center justify-center">
        <ins 
          className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client={publisherId}
          data-ad-slot={slotId}
          data-ad-format={format}
          data-full-width-responsive={responsive ? 'true' : 'false'}
        />
      </div>
      
      <div className="mt-4 flex items-center gap-2 opacity-20">
         <Megaphone className="w-3 h-3" />
         <span className="text-[8px] font-black uppercase tracking-widest">Anúncio Google</span>
      </div>
    </Card>
  )
}
