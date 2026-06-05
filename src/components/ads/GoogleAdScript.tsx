"use client"

import * as React from "react"
import Script from "next/script"

/**
 * Componente responsável pela injeção ÚNICA e GLOBAL do script do Google AdSense.
 * Injetado no Root Layout para garantir verificação de domínio e entrega de anúncios.
 */
export function GoogleAdScript() {
  return (
    <Script 
      id="google-adsense-init"
      async 
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3790085999731396"
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  )
}
