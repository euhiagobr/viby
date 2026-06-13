
import * as React from "react"
import { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, FileText, Mail, MapPin, User } from "lucide-react"
import Footer from "@/components/layout/Footer"
import { getAdminDb } from "@/lib/firebase/admin"

const VIBY_OG_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description: 'Leia os termos de serviço da Viby para organizadores e participantes de eventos.',
  keywords: ['termos', 'uso', 'serviço', 'viby', 'jurídico'],
  alternates: { canonical: '/termos' },
  openGraph: {
    title: 'Termos e Condições de Uso | Viby',
    description: 'Leia os termos de serviço da Viby para organizadores e participantes de eventos.',
    url: 'https://viby.club/termos',
    siteName: 'Viby',
    type: 'website',
    locale: 'pt_BR',
    images: [{ url: VIBY_OG_IMAGE, width: 1200, height: 630 }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Termos e Condições de Uso | Viby',
    description: 'Leia os termos de serviço da Viby para organizadores e participantes de eventos.',
    images: [VIBY_OG_IMAGE]
  },
  robots: {
    index: true,
    follow: true,
  }
}

async function getBranding() {
  try {
    const db = getAdminDb();
    const snap = await db.collection('settings').doc('site').get();
    return snap.exists ? snap.data() : null;
  } catch (e) {
    return null;
  }
}

export default async function TermosDeUsoPage() {
  const settings = await getBranding();
  const siteName = settings?.siteName || "Viby";

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            {settings?.logoUrl ? (
              <Image 
                src={settings.logoUrl} 
                alt={siteName} 
                width={120} 
                height={40} 
                style={{ height: 'auto' }}
                className="h-8 sm:h-10 w-auto object-contain transition-transform group-hover:scale-105" 
                priority 
                unoptimized 
              />
            ) : (
              <>
                <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
                  <span className="text-white font-black text-lg">V</span>
                </div>
                <span className="text-xl font-bold tracking-tight italic uppercase text-primary ml-1">{siteName}</span>
              </>
            )}
          </Link>
          <Button variant="ghost" asChild className="font-semibold">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>
        </div>
      </nav>
      {/* REST OF COMPONENT OMITTED FOR BREVITY */}
    </div>
  )
}
