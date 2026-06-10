import * as React from "react"
import { Metadata } from "next"
import LandingPageClient from "./LandingPageClient"

const VIBY_OG_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

export const metadata: Metadata = {
  title: 'Viby | Descubra e Viva Experiências Incríveis',
  description: 'A maior vitrine de eventos do Brasil. Encontre shows, festivais, workshops e muito mais na sua cidade.',
  keywords: ['eventos', 'ingressos', 'shows', 'experiências', 'viby', 'baladas', 'festivais'],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Viby | Descubra e Viva Experiências Incríveis',
    description: 'A maior vitrine de eventos do Brasil. Encontre shows, festivais, workshops e muito mais na sua cidade.',
    url: 'https://viby.club',
    siteName: 'Viby',
    type: 'website',
    locale: 'pt_BR',
    images: [
      {
        url: VIBY_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'Viby',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Viby | Descubra e Viva Experiências Incríveis',
    description: 'A maior vitrine de eventos do Brasil. Encontre shows, festivais, workshops e muito mais na sua cidade.',
    images: [VIBY_OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
  }
}

export default function LandingPage() {
  return <LandingPageClient />
}
