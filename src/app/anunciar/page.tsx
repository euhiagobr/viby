import * as React from "react"
import { Metadata } from "next"
import OrganizerLandingPage from "./OrganizerLandingPage"

export const metadata: Metadata = {
  title: 'Venda Ingressos e Divulgue seus Eventos | Viby para Organizadores',
  description: 'A plataforma completa para produtores de eventos. Venda ingressos online, gerencie participantes com QR Code e alcance milhares de pessoas.',
  keywords: ['venda de ingressos', 'produtor de eventos', 'organizador de festas', 'divulgação de eventos', 'viby', 'gestão de eventos'],
  alternates: { canonical: 'https://viby.club/anunciar' },
  openGraph: {
    title: 'Venda Ingressos e Divulgue seus Eventos | Viby',
    description: 'Crie eventos, venda ingressos online, receba pagamentos com segurança e alcance mais pessoas.',
    url: 'https://viby.club/anunciar',
    siteName: 'Viby',
    type: 'website',
    locale: 'pt_BR',
    images: [{ url: 'https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417', width: 1200, height: 630 }]
  }
}

export default function AnnouncePage() {
  return <OrganizerLandingPage />
}
