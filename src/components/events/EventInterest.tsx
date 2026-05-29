
"use client"

import * as React from "react"
import { useFirestore, useAuth, useUser, useDoc, useCollection, useMemoFirebase } from "@/firebase"
import { doc, updateDoc, increment, serverTimestamp, setDoc, deleteDoc, collection, query, where } from "firebase/firestore"
import { Heart, Users, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

interface EventInterestProps {
  event: any
  className?: string
  showButton?: boolean
  variant?: 'default' | 'compact'
}

/**
 * Componente unificado para gerir interessados e confirmados reais.
 */
export function EventInterest({ event, className, showButton = true, variant = 'default' }: EventInterestProps) {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  
  const eventId = event?.id
  const isInternal = event?.type === 'interno'
  
  // 1. Estado de Interesse do Usuário Logado
  const interestRef = React.useMemo(() => 
    (db && user && eventId) ? doc(db, "events", eventId, "interests", user.uid) : null, 
    [db, user, eventId]
  )
  const { data: userInterest } = useDoc<any>(interestRef)
  const isInterested = !!userInterest

  // 2. Contador de Confirmados (Vendas Reais Confirmadas)
  const confirmedQuery = useMemoFirebase(() => {
    if (!db || !eventId || !isInternal) return null
    return query(
      collection(db, "registrations"), 
      where("eventId", "==", eventId),
      where("paymentStatus", "in", ["Pago", "Disponível"])
    )
  }, [db, eventId, isInternal])
  
  const { data: registrations } = useCollection<any>(confirmedQuery)
  const confirmedCount = registrations?.length || 0

  const [toggling, setToggling] = React.useState(false)

  const handleToggleInterest = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!db || !user) {
      toast({ title: "Ação necessária", description: "Faça login para marcar interesse." })
      return
    }

    if (!eventId || toggling) return
    setToggling(true)

    try {
      const eventRef = doc(db, "events", eventId)
      if (isInterested) {
        await deleteDoc(interestRef!)
        await updateDoc(eventRef, { interestedCount: increment(-1), updatedAt: serverTimestamp() })
      } else {
        await setDoc(interestRef!, { userId: user.uid, timestamp: serverTimestamp() })
        await updateDoc(eventRef, { interestedCount: increment(1), updatedAt: serverTimestamp() })
        toast({ title: "Interesse registrado!" })
      }
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `events/${eventId}/interests`,
          operation: isInterested ? 'delete' : 'create'
        }))
      }
    } finally {
      setToggling(false)
    }
  }

  if (variant === 'compact') {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="flex items-center gap-1 text-[10px] font-black uppercase text-muted-foreground">
          <Heart className={cn("w-3.5 h-3.5", isInterested ? "fill-red-500 text-red-500" : "opacity-40")} />
          {event.interestedCount || 0}
        </div>
        {isInternal && (
          <div className="flex items-center gap-1 text-[10px] font-black uppercase text-secondary">
            <Users className="w-3.5 h-3.5" />
            {confirmedCount}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-4", className)}>
      {showButton && (
        <Button
          onClick={handleToggleInterest}
          disabled={toggling}
          variant="outline"
          className={cn(
            "rounded-full px-6 h-11 font-black uppercase italic transition-all active:scale-95 gap-2 border-2",
            isInterested ? "bg-red-50 border-red-200 text-red-500" : "border-secondary text-secondary"
          )}
        >
          {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className={cn("w-4 h-4", isInterested && "fill-current")} />}
          {isInterested ? "Interessado" : "Tenho Interesse"}
        </Button>
      )}

      <div className="flex items-center gap-6">
        <div className="flex flex-col">
          <span className="text-xl font-black text-primary leading-none">{event.interestedCount || 0}</span>
          <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest opacity-60">Interessados</span>
        </div>
        {isInternal && (
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 text-xl font-black text-secondary leading-none">
              {confirmedCount}
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest opacity-60">Confirmados</span>
          </div>
        )}
      </div>
    </div>
  )
}
