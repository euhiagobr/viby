import * as React from "react"
import { Metadata } from "next"
import EarnMoneyClient from "./EarnMoneyClient"

const VIBY_OG_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

export const metadata: Metadata = {
  title: 'Ganhe Dinheiro com a Viby | Programa de Afiliados e Indicação',
  description: 'Monetize sua influência indicando novos organizadores para a Viby. Ganhe comissões por indicação e renda extra online sobre cada ingresso vendido pelos seus indicados.',
  keywords: ['programa de afiliados', 'ganhar dinheiro com eventos', 'afiliado de eventos', 'comissão por indicação', 'renda extra online', 'divulgar eventos', 'viby'],
  alternates: { canonical: '/ganhe-dinheiro' },
  openGraph: {
    title: 'Ganhe Dinheiro com a Viby | Programa de Afiliados',
    description: 'Indique marcas e produtores e receba comissões automáticas. Saiba como ser um embaixador Viby e garantir renda extra.',
    url: 'https://viby.club/ganhe-dinheiro',
    siteName: 'Viby',
    type: 'website',
    locale: 'pt_BR',
    images: [{ url: VIBY_OG_IMAGE, width: 1200, height: 630 }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ganhe Dinheiro com a Viby | Programa de Afiliados',
    description: 'Indique marcas e produtores e receba comissões automáticas. Saiba como ser um embaixador Viby.',
    images: [VIBY_OG_IMAGE]
  },
  robots: {
    index: true,
    follow: true,
  }
}

export default function EarnMoneyPage() {
  return <EarnMoneyClient />
}
