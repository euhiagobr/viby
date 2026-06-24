
import * as React from "react"
import { Metadata } from "next"
import EarnMoneyClient from "./EarnMoneyClient"

const VIBY_EARN_OG = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

export const metadata: Metadata = {
  title: 'Ganhe Dinheiro com a Viby | Programa de Afiliados',
  description: 'Monetize sua influência indicando novos organizadores para a Viby. Ganhe comissões automáticas por cada ingresso vendido.',
  keywords: ['programa de afiliados', 'ganhar dinheiro com eventos', 'afiliado de eventos', 'comissão por indicação', 'renda extra online', 'viby'],
  alternates: { canonical: 'https://viby.club/ganhe-dinheiro' },
  openGraph: {
    title: 'Ganhe Dinheiro com a Viby | Programa de Afiliados',
    description: 'Indique marcas e produtores e receba comissões automáticas. Saiba como ser um embaixador Viby.',
    url: 'https://viby.club/ganhe-dinheiro',
    siteName: 'Viby',
    type: 'website',
    locale: 'pt_BR',
    images: [{ url: VIBY_EARN_OG, width: 1200, height: 630 }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ganhe Dinheiro com a Viby',
    description: 'Receba comissões por indicações de eventos.',
    images: [VIBY_EARN_OG]
  }
}

export default function EarnMoneyPage() {
  return <EarnMoneyClient />
}
