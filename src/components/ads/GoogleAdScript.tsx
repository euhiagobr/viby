"use client"

import * as React from "react"
import Script from "next/script"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"

/**
 * Componente responsável pela injeção do script global do Google AdSense.
 * Permite a verificação da conta e o funcionamento dos Auto Ads.
 * Otimizado para verificação imediata pelo robô do AdSense.
 */
export function GoogleAdScript() {
  const db = useFirestore()
  const settingsRef = React.useMemo(() => db ? doc(db, "system_settings", "google_ads") : null, [db])
  const { data: googleAds } = useDoc<any>(settingsRef)

  // Seu ID de cliente oficial - ca-pub-3790085999731396
  const clientID = "ca-pub-3790085999731396"
  const defaultSrc = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientID}`

  // Determinamos se o script deve ser habilitado.
  // Durante a fase de verificação, habilitamos por padrão para garantir a detecção pelo robô.
  const isEnabled = googleAds?.enabled !== false

  if (!isEnabled) return null

  // Tenta extrair o SRC customizado se existir nas configurações do sistema
  const customCode = googleAds?.adsenseCode || ""
  const scriptMatch = customCode.match(/src="([^"]+)"/)
  const scriptSrc = scriptMatch ? scriptMatch[1] : defaultSrc

  return (
    <Script 
      async 
      src={scriptSrc}
      crossOrigin="anonymous"
      strategy="afterInteractive"
      data-ai-hint="google adsense"
    />
  )
}
