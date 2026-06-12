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
              <Image src={settings.logoUrl} alt={siteName} width={120} height={40} className="h-8 sm:h-10 w-auto object-contain transition-transform group-hover:scale-105" priority unoptimized />
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

      <div className="container mx-auto px-4 py-12 md:py-20 flex-1">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="space-y-4 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-[10px] font-black uppercase tracking-widest">
              <FileText className="w-3 h-3" />
              Regulamento Geral
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic text-primary">
              Termos de <span className="text-secondary">Uso</span>
            </h1>
            <p className="text-muted-foreground font-medium">
              Última atualização: 19 de maio de 2026
            </p>
          </div>

          <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
            <CardContent className="p-8 md:p-12 prose prose-slate max-w-none">
              <div className="space-y-8 text-foreground/80 leading-relaxed font-medium text-sm md:text-base">
                <p>
                  Bem-vindo à {siteName}. Ao acessar ou utilizar a plataforma, você concorda com os presentes Termos de Uso.
                </p>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">1.</span> Sobre a Plataforma
                  </h2>
                  <p>A {siteName} é uma vitrine digital para divulgação, gerenciamento e comercialização de eventos.</p>
                  <p>A plataforma permite que usuários descubram experiências, sigam marcas e adquiram ingressos de forma segura.</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">2.</span> Responsabilidades
                  </h2>
                  <div className="bg-muted/30 p-6 rounded-2xl border-l-4 border-secondary space-y-2">
                    <p className="font-black text-xs uppercase tracking-widest text-primary mb-2">O usuário compromete-se a:</p>
                    <ul className="list-disc ml-4 space-y-1">
                      <li>Manter a segurança de sua conta;</li>
                      <li>Fornecer informações verídicas;</li>
                      <li>Não compartilhar credenciais de acesso.</li>
                    </ul>
                  </div>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">3.</span> Ingressos e Reembolsos
                  </h2>
                  <p>Os pagamentos são processados pela Stripe. Solicitações de cancelamento podem ser realizadas conforme as políticas de cada evento.</p>
                </section>

                <section className="space-y-6">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">4.</span> Contato Legal
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-4 bg-muted/20 rounded-xl">
                      <User className="w-5 h-5 text-secondary" />
                      <div>
                        <p className="text-[10px] font-black uppercase opacity-60">Representante</p>
                        <p className="font-bold">Administração Viby</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-muted/20 rounded-xl">
                      <Mail className="w-5 h-5 text-secondary" />
                      <div>
                        <p className="text-[10px] font-black uppercase opacity-60">E-mail Jurídico</p>
                        <p className="font-bold">legal@viby.club</p>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  )
}
