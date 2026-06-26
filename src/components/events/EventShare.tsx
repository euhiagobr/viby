
"use client"

import * as React from "react"
import { 
  Share2, 
  Link as LinkIcon, 
  Facebook, 
  Check, 
  Copy,
  MoreHorizontal
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface EventShareProps {
  eventId: string
  title: string
  url: string
  className?: string
}

/**
 * @fileOverview Componente de Compartilhamento Premium da Viby.
 * Lógica: Web Share API (Mobile) -> Popover Fallback (Desktop).
 */
export function EventShare({ eventId, title, url, className }: EventShareProps) {
  const [isCopied, setIsCopied] = React.useState(false)
  const [isShareSupported, setIsShareSupported] = React.useState(false)

  // Montagem da URL completa
  const fullUrl = React.useMemo(() => {
    if (typeof window === 'undefined') return url
    const base = window.location.origin
    const path = url.startsWith('/') ? url : `/${url}`
    return `${base}${path}?vsrc=share`
  }, [url])

  // Verifica suporte à API nativa no lado do cliente
  React.useEffect(() => {
    if (typeof navigator !== 'undefined' && !!navigator.share) {
      setIsShareSupported(true)
    }
  }, [])

  // Rastreamento de métricas no servidor
  const trackShare = async () => {
    try {
      await fetch('/api/events/track-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId })
      })
    } catch (e) {
      console.warn("[Share Tracking Error]", e)
    }
  }

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: title,
        text: `Confira este evento na Viby: ${title}`,
        url: fullUrl,
      })
      trackShare()
    } catch (err) {
      // Se o usuário cancelar ou falhar, não faz nada
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullUrl)
    setIsCopied(true)
    toast({ title: "Link copiado!", description: "Compartilhe onde desejar." })
    trackShare()
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleFacebookShare = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}`
    window.open(fbUrl, '_blank', 'width=600,height=400')
    trackShare()
  }

  // Se o navegador suporta Share API (Geralmente Mobile), usamos o botão direto
  if (isShareSupported) {
    return (
      <Button 
        onClick={handleNativeShare}
        variant="outline"
        className={cn(
          "rounded-full h-11 px-6 font-black uppercase italic text-[10px] tracking-widest gap-2 border-2 transition-all active:scale-95 border-secondary/20 text-secondary hover:bg-secondary hover:text-white hover:border-secondary",
          className
        )}
      >
        <Share2 className="w-4 h-4" />
        Compartilhar
      </Button>
    )
  }

  // Fallback para Desktop: Popover com opções
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline"
          className={cn(
            "rounded-full h-11 px-6 font-black uppercase italic text-[10px] tracking-widest gap-2 border-2 border-secondary/20 text-secondary hover:bg-secondary/5",
            className
          )}
        >
          <Share2 className="w-4 h-4" />
          Compartilhar
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2 rounded-[1.5rem] border-none shadow-2xl bg-white/95 backdrop-blur-md">
        <div className="space-y-1">
          <p className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Opções de Divulgação</p>
          
          <button 
            onClick={handleCopyLink}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/10 rounded-xl transition-colors text-left group"
          >
            <div className="p-2 bg-muted rounded-lg group-hover:bg-secondary group-hover:text-white transition-colors">
              {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </div>
            <span className="text-xs font-bold text-primary uppercase">Copiar Link</span>
          </button>

          <button 
            onClick={handleFacebookShare}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 rounded-xl transition-colors text-left group"
          >
            <div className="p-2 bg-muted rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Facebook className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-primary uppercase">Facebook</span>
          </button>

          <div className="p-3 mt-2 bg-muted/30 rounded-xl border border-dashed flex items-start gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-secondary shrink-0" />
            <p className="text-[8px] font-medium text-muted-foreground uppercase leading-tight">
              Seu compartilhamento gera pontos de visibilidade para a marca.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
