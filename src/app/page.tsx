
import * as React from "react"
import { Metadata } from "next"
import LandingPageClient from "./LandingPageClient"

export const metadata: Metadata = {
  title: 'Viby | Descubra e Viva Experiências Incríveis',
  description: 'A maior vitrine de eventos do Brasil. Encontre shows, festivais, workshops e muito mais na sua cidade.',
  openGraph: {
    title: 'Viby | Descubra e Viva Experiências Incríveis',
    description: 'A maior vitrine de eventos do Brasil. Encontre shows, festivais, workshops e muito mais na sua cidade.',
    images: ['/api/og?type=platform'],
  },
}

export default function LandingPage() {
  return <LandingPageClient />
}
