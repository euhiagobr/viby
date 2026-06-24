import * as React from "react"
import { Metadata } from "next"
import FAQClient from "./FAQClient"

const VIBY_OG_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

export const metadata: Metadata = {
  title: 'FAQ | Central de Ajuda Viby',
  description: 'Tire suas dúvidas sobre o funcionamento da Viby: ingressos, organizações, pagamentos e segurança.',
  keywords: ['faq', 'ajuda', 'suporte', 'viby', 'dúvidas'],
  alternates: { canonical: 'https://viby.club/suporte/faq' },
  openGraph: {
    title: 'FAQ | Central de Ajuda Viby',
    description: 'Tire suas dúvidas sobre o funcionamento da Viby: ingressos, organizações, pagamentos e segurança.',
    url: 'https://viby.club/suporte/faq',
    siteName: 'Viby',
    type: 'website',
    locale: 'pt_BR',
    images: [{ url: VIBY_OG_IMAGE, width: 1200, height: 630 }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FAQ | Central de Ajuda Viby',
    description: 'Tire suas dúvidas sobre o funcionamento da Viby: ingressos, organizações, pagamentos e segurança.',
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
