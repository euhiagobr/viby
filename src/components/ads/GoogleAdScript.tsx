
"use client"

import * as React from "react"
import Script from "next/script"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"

/**
 * Componente responsável pela injeção do script global do Google AdSense.
 * Permite a verificação da conta e o funcionamento dos Auto Ads.
 */
export function GoogleAdScript() {
  const db = useFirestore()
  const settingsRef = React.useMemo(() => db ? doc(db, "system_settings", "google_ads") : null, [db])
  const { data: googleAds } = useDoc<any>(settingsRef)

  // Script padrão fornecido para verificação inicial
  const defaultSrc = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3790085999731396"

  // Se o documento não existir ou estiver desativado no banco, 
  // carregamos o padrão para garantir a verificação da conta se o usuário solicitou.
  const isEnabled = googleAds?.enabled ?? true
  if (!isEnabled) return null

  // Tenta extrair o SRC customizado do banco de dados se existir
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
