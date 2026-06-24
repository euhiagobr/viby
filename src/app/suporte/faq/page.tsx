import * as React from "react"
import { Metadata } from "next"
import FAQClient from "./FAQClient"

const VIBY_OG_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

export const metadata: Metadata = {
  title: 'Central de Ajuda e FAQ | Suporte Oficial Viby',
  description: 'Tire suas dúvidas sobre ingressos, estornos, segurança da conta e como anunciar seu evento na Viby. Estamos aqui para ajudar.',
  keywords: ['faq viby', 'ajuda ingressos', 'estorno viby', 'suporte ao organizador', 'segurança viby'],
  alternates: { canonical: 'https://viby.club/suporte/faq' },
  openGraph: {
    title: 'FAQ | Central de Ajuda Viby',
    description: 'Precisa de ajuda? Encontre respostas rápidas para as dúvidas mais comuns de usuários e produtores.',
    url: 'https://viby.club/suporte/faq',
    siteName: 'Viby',
    type: 'website',
    locale: 'pt_BR',
    images: [{ url: VIBY_OG_IMAGE, width: 1200, height: 630 }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Suporte Viby | Perguntas Frequentes',
    description: 'Tudo o que você precisa saber sobre a plataforma Viby em um só lugar.',
    images: [VIBY_OG_IMAGE]
  },
  robots: {
    index: true,
    follow: true,
  }
}

export default function FAQPage() {
  return <FAQClient />
}
