import * as React from "react"
import { Metadata } from "next"
import Link from "next/link"
import EarnMoneyClient from "./EarnMoneyClient"

export const metadata: Metadata = {
  title: 'Programa de Afiliados',
  description: 'Monetize sua influência indicando novos organizadores para a Viby. Ganhe comissões vitalícias sobre cada ingresso vendido.',
  alternates: { canonical: '/ganhe-dinheiro' },
  openGraph: {
    title: 'Ganhe Dinheiro com a Viby | Programa de Afiliados',
    description: 'Indique marcas e produtores e receba comissões automáticas. Saiba como ser um embaixador Viby.',
    type: 'website'
  }
}

export default function EarnMoneyPage() {
  return <EarnMoneyClient />
}
