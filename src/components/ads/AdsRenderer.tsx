
"use client"

import * as React from "react"
import { useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase"
import { doc, collection, query, where, limit } from "firebase/firestore"
import { AdCard } from "./AdCard"
import { GoogleAd } from "./GoogleAd"

interface AdsRendererProps {
  location: string
  index?: number // Índice do slot de anúncio para alternância
  className?: string
  googleSlotId?: string
  variant?: 'default' | 'premium'
}

/**
 * Motor de Mediação de Anúncios Viby
 * Regras:
 * 1. Se Google OFF -> Viby 100%
 * 2. Se Viby OFF -> Google 100%
 * 3. Ambos ON -> Alternância 50/50 baseada no índice do slot
 * 4. Fallback: Se Viby não tiver campanhas ativas -> Google 100%
 */
export function AdsRenderer({ 
  location, 
  index = 0, 
  className, 
  googleSlotId = "default-slot",
  variant = "default" 
}: AdsRendererProps) {
  const db = useFirestore()

  // 1. Buscar Configurações Globais do Google Ads
  const googleSettingsRef = React.useMemo(() => db ? doc(db, "system_settings", "google_ads") : null, [db])
  const { data: googleSettings } = useDoc<any>(googleSettingsRef)

  // 2. Buscar Campanhas Viby Ads Ativas
  const vibyAdsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "ads"), where("status", "==", "Ativo"), limit(10))
  }, [db])
  const { data: vibyAds } = useCollection<any>(vibyAdsQuery)

  const isGoogleEnabled = googleSettings?.enabled === true
  const hasVibyCampaigns = vibyAds && vibyAds.length > 0

  // Determinar qual provedor exibir neste slot específico
  const provider = React.useMemo(() => {
    if (!isGoogleEnabled && hasVibyCampaigns) return "viby"
    if (isGoogleEnabled && !hasVibyCampaigns) return "google"
    if (isGoogleEnabled && hasVibyCampaigns) {
      // Regra de Alternância 50/50 baseada na posição do slot
      return index % 2 === 0 ? "google" : "viby"
    }
    // Se ambos estiverem OFF ou Google ON mas sem campanhas Viby (e vice-versa)
    if (isGoogleEnabled) return "google"
    if (hasVibyCampaigns) return "viby"
    
    return null
  }, [isGoogleEnabled, hasVibyCampaigns, index])

  if (!provider) return null

  if (provider === "google" && googleSettings?.publisherId) {
    return (
      <GoogleAd 
        publisherId={googleSettings.publisherId} 
        slotId={googleSlotId} 
        className={className} 
      />
    )
  }

  if (provider === "viby" && hasVibyCampaigns) {
    // Seleção de campanha Viby (Round-robin simples baseado no index)
    const selectedAd = vibyAds[index % vibyAds.length]
    return <AdCard ad={selectedAd} variant={variant} />
  }

  return null
}
