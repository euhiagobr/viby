"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Share2, Link as LinkIcon, Instagram, Phone } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface EventShareProps {
  title: string
  url: string
}

export function EventShare({ title, url }: EventShareProps) {
  const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${url}` : url

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl)
    toast({ title: "Link copiado!", description: "Agora você pode compartilhar onde quiser." })
  }

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url: fullUrl })
      } catch (e) {}
    } else {
      handleCopy()
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
       <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-2" onClick={handleNativeShare}>
          <Share2 className="w-4 h-4" />
       </Button>
       <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-2" onClick={handleCopy}>
          <LinkIcon className="w-4 h-4" />
       </Button>
       <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-2" asChild>
          <a href={`https://wa.me/?text=${encodeURIComponent(`${title}: ${fullUrl}`)}`} target="_blank">
             <Phone className="w-4 h-4" />
          </a>
       </Button>
    </div>
  )
}
