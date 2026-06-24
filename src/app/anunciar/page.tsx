import * as React from "react"
import { Metadata } from "next"
import OrganizerLandingPage from "./OrganizerLandingPage"

const VIBY_CAPA = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibycapa.jpeg?alt=media&token=352689b1-73e0-409b-ad29-e1c5e660bac0";

export const metadata: Metadata = {
  title: 'Venda Ingressos e Divulgue seu Evento | Viby para Produtores',
  description: 'A plataforma completa para organizadores de eventos. Venda ingressos online, gerencie participantes com QR Code e alcance milhares de pessoas na rede Viby.',
  keywords: ['venda de ingressos', 'organizador de eventos', 'plataforma de eventos', 'gestão de bilheteria', 'divulgação de shows', 'viby para empresas'],
  alternates: { canonical: 'https://viby.club/anunciar' },
  openGraph: {
    title: 'Viby para Organizadores | Bilheteria e Divulgação Inteligente',
    description: 'Crie eventos, venda ingressos online e receba pagamentos com segurança. Gestão completa para sua marca ou produtora.',
    url: 'https://viby.club/anunciar',
    siteName: 'Viby',
    type: 'website',
    locale: 'pt_BR',
    images: [{ url: VIBY_CAPA, width: 1200, height: 630 }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Venda Ingressos na Viby',
    description: 'Transforme sua produção com a melhor tecnologia de bilheteria e alcance do Brasil.',
    images: [VIBY_CAPA]
  }
}

export default function AnnouncePage() {
  return <OrganizerLandingPage />
}
