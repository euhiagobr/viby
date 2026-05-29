"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Share2, Link as LinkIcon, Instagram, Phone } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useFirestore } from "@/firebase"
import { doc, updateDoc, increment, serverTimestamp } from "firebase/firestore"
import { cn } from "@/lib/utils"

interface EventShareProps {
  eventId: string
  title: string
  url: string
}

/**
 * Componente de compartilhamento com contabilização de métricas.
 * Implementa proteção contra spam via localStorage (cooldown de 30s).
 */
export function EventShare({ eventId, title, url }: EventShareProps) {
  const db = useFirestore()
  const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${url}` : url

  const trackShare = React.useCallback(async () => {
    if (!db || !eventId) return

    // Lógica Anti-Spam: Cooldown de 30 segundos por dispositivo/evento
    const storageKey = `viby_share_cooldown_${eventId}`
    const lastShare = localStorage.getItem(storageKey)
    const now = Date.now()

    if (lastShare && now - parseInt(lastShare) < 30000) {
      return // Silenciosamente ignora se clicou muito rápido
    }

    try {
      const eventRef = doc(db, "events", eventId)
      await updateDoc(eventRef, {
        sharesCount: increment(1),
        updatedAt: serverTimestamp()
      })
      localStorage.setItem(storageKey, now.toString())
    } catch (e) {
      console.warn("[Share Tracking Error]", e)
    }
  }, [db, eventId])

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl)
    toast({ title: "Link copiado!", description: "Agora você pode compartilhar onde quiser." })
    trackShare()
  }

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url: fullUrl })
        trackShare()
      } catch (e) {
        // Usuário cancelou ou falhou, não contabilizamos
      }
    } else {
      handleCopy()
    }
  }

  const handleSocialClick = () => {
    trackShare()
  }

  return (
    <div className="flex flex-wrap gap-2">
       <Button 
         variant="outline" 
         size="icon" 
         className="rounded-full h-10 w-10 border-2 hover:bg-secondary hover:text-white hover:border-secondary transition-all" 
         onClick={handleNativeShare}
         title="Compartilhar"
       >
          <Share2 className="w-4 h-4" />
       </Button>
       
       <Button 
         variant="outline" 
         size="icon" 
         className="rounded-full h-10 w-10 border-2 hover:bg-secondary hover:text-white hover:border-secondary transition-all" 
         onClick={handleCopy}
         title="Copiar Link"
       >
          <LinkIcon className="w-4 h-4" />
       </Button>

       <Button 
         variant="outline" 
         size="icon" 
         className="rounded-full h-10 w-10 border-2 hover:bg-secondary hover:text-white hover:border-secondary transition-all" 
         asChild
         onClick={handleSocialClick}
         title="WhatsApp"
       >
          <a href={`https://wa.me/?text=${encodeURIComponent(`${title}: ${fullUrl}`)}`} target="_blank" rel="noopener noreferrer">
             <Phone className="w-4 h-4" />
          </a>
       </Button>
    </div>
  )
}
