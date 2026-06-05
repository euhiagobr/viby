
"use client"

import * as React from "react"
import { useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase"
import { doc, collection, query, where, limit } from "firebase/firestore"
import { AdCard } from "./AdCard"
import { GoogleAd } from "./GoogleAd"
import { Loader2 } from "lucide-react"

interface AdsRendererProps {
  location: string
  index?: number
  className?: string
  googleSlotId?: string
}

export function AdsRenderer({ location, index = 0, className, googleSlotId = "default-slot" }: AdsRendererProps) {
  const db = useFirestore()

  // 1. Buscar Configurações do Google Ads
  const googleSettingsRef = React.useMemo(() => db ? doc(db, "system_settings", "google_ads") : null, [db])
  const { data: googleSettings } = useDoc<any>(googleSettingsRef)

  // 2. Buscar Anúncios Viby Ativos
  const vibyAdsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "ads"), where("status", "==", "Ativo"), limit(10))
  }, [db])
  const { data: vibyAds } = useCollection<any>(vibyAdsQuery)

  const isGoogleEnabled = googleSettings?.enabled === true
  const hasVibyAds = vibyAds && vibyAds.length > 0

  // Lógica de Alternância 50/50 baseada no index
  const showGoogle = React.useMemo(() => {
    if (isGoogleEnabled && !hasVibyAds) return true
    if (!isGoogleEnabled && hasVibyAds) return false
    if (isGoogleEnabled && hasVibyAds) {
      return index % 2 === 0 // Par = Google, Ímpar = Viby
    }
    return false
  }, [isGoogleEnabled, hasVibyAds, index])

  if (!isGoogleEnabled && !hasVibyAds) return null

  if (showGoogle && googleSettings?.publisherId) {
    return (
      <GoogleAd 
        publisherId={googleSettings.publisherId} 
        slotId={googleSlotId} 
        className={className} 
      />
    )
  }

  if (hasVibyAds) {
    // Escolher um anúncio Viby aleatório ou baseado no index para distribuição
    const selectedAd = vibyAds[index % vibyAds.length]
    return <AdCard ad={selectedAd} />
  }

  return null
}
