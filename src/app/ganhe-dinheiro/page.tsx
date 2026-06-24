import * as React from "react"
import { Metadata } from "next"
import EarnMoneyClient from "./EarnMoneyClient"

const VIBY_CAPA = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibycapa.jpeg?alt=media&token=352689b1-73e0-409b-ad29-e1c5e660bac0";

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
    images: [{ url: VIBY_CAPA, width: 1200, height: 630 }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ganhe Dinheiro com a Viby',
    description: 'Torne-se um parceiro oficial e lucre indicando os melhores eventos do Brasil.',
    images: [VIBY_CAPA]
  }
}

export default function EarnMoneyPage() {
  return <EarnMoneyClient />
}
