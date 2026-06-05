
"use client"

import * as React from "react"
import Script from "next/script"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"

export function GoogleAdScript() {
  const db = useFirestore()
  const settingsRef = React.useMemo(() => db ? doc(db, "system_settings", "google_ads") : null, [db])
  const { data: googleAds } = useDoc<any>(settingsRef)

  if (!googleAds?.enabled || !googleAds?.adsenseCode) return null

  // Extrair o SRC do script de forma segura
  const scriptMatch = googleAds.adsenseCode.match(/src="([^"]+)"/);
  const scriptSrc = scriptMatch ? scriptMatch[1] : null;

  if (!scriptSrc) return null;

  return (
    <Script 
      async 
      src={scriptSrc}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  )
}
