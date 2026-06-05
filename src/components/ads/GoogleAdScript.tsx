"use client"

import * as React from "react"
import Script from "next/script"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"

/**
 * Componente responsável pela injeção do script global do Google AdSense.
 * Permite a verificação da conta e o funcionamento dos Auto Ads.
 * Ajustado para renderização imediata para facilitar a detecção pelo rastreador.
 */
export function GoogleAdScript() {
  const db = useFirestore()
  const settingsRef = React.useMemo(() => db ? doc(db, "system_settings", "google_ads") : null, [db])
  // Usamos loading para garantir que o script esteja presente mesmo durante o fetch inicial
  const { data: googleAds, loading } = useDoc<any>(settingsRef)

  // Seu ID de cliente oficial
  const defaultClient = "ca-pub-3790085999731396"
  const defaultSrc = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${defaultClient}`

  // O crawler do Google precisa ver a tag no carregamento inicial da página.
  // Injetamos o script se estiver carregando ou se estiver ativado.
  const isEnabled = loading || googleAds?.enabled !== false
  if (!isEnabled) return null

  // Tenta extrair o SRC customizado do banco de dados se existir, senão usa o padrão
  const customCode = googleAds?.adsenseCode || ""
  const scriptMatch = customCode.match(/src="([^"]+)"/)
  const scriptSrc = scriptMatch ? scriptMatch[1] : defaultSrc

  return (
    <Script 
      async 
      src={scriptSrc}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  )
}
