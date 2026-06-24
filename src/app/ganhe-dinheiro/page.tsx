import * as React from "react"
import { Metadata } from "next"
import EarnMoneyClient from "./EarnMoneyClient"

const VIBY_EARN_OG = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

export const metadata: Metadata = {
  title: 'Ganhe Dinheiro com a Viby | Programa de Afiliados Oficial',
  description: 'Monetize sua influência e rede de contatos indicando novos organizadores para a Viby. Ganhe comissões automáticas por cada ingresso vendido por eles.',
  keywords: ['programa de afiliados', 'ganhar dinheiro online', 'afiliado de eventos', 'renda extra', 'comissão por indicação', 'embaixador viby'],
  alternates: { canonical: 'https://viby.club/ganhe-dinheiro' },
  openGraph: {
    title: 'Programa de Embaixadores Viby | Indique e Ganhe',
    description: 'Indique marcas e produtores e receba comissões sobre as vendas de ingressos. Faça parte da nossa rede de crescimento.',
    url: 'https://viby.club/ganhe-dinheiro',
    siteName: 'Viby',
    type: 'website',
    locale: 'pt_BR',
    images: [{ url: VIBY_EARN_OG, width: 1200, height: 630 }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ganhe Dinheiro com a Viby',
    description: 'Torne-se um parceiro oficial e lucre indicando os melhores eventos do Brasil.',
    images: [VIBY_EARN_OG]
  }
}

export default function EarnMoneyPage() {
  return <EarnMoneyClient />
}
