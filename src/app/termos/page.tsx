import * as React from "react"
import { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, FileText, Mail, MapPin, User } from "lucide-react"
import Footer from "@/components/layout/Footer"
import { getAdminDb } from "@/lib/firebase/admin"

const VIBY_CAPA = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibycapa.jpeg?alt=media&token=352689b1-73e0-409b-ad29-e1c5e660bac0";

export const metadata: Metadata = {
  title: 'Termos e Condições de Uso | Regras da Plataforma Viby',
  description: 'Conheça os termos de serviço da Viby para organizadores e participantes. Transparência e segurança jurídica para quem vive e organiza experiências.',
  keywords: ['termos de uso', 'regras do site', 'contrato viby', 'termos para produtores', 'segurança jurídica'],
  alternates: { canonical: 'https://viby.club/termos' },
  openGraph: {
    title: 'Termos e Condições de Uso | Viby',
    description: 'Leia as regras e condições para utilização da plataforma Viby por usuários e produtores.',
    url: 'https://viby.club/termos',
    siteName: 'Viby',
    type: 'website',
    locale: 'pt_BR',
    images: [{ url: VIBY_CAPA, width: 1200, height: 630 }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Termos de Uso Viby',
    description: 'Regras de utilização da plataforma.',
    images: [VIBY_CAPA]
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

      <main className="flex-1 container mx-auto px-4 py-16 md:py-24 max-w-4xl space-y-12 animate-in fade-in duration-700">
         <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-primary">Termos e <span className="text-secondary">Condições</span></h1>
            <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">Última atualização: 19 de maio de 2026</p>
         </div>

         <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
            <CardContent className="p-8 md:p-12 prose prose-slate max-w-none text-sm md:text-base leading-relaxed font-medium">
               <p>Bem-vindo à {siteName}. Ao acessar ou utilizar a plataforma, você concorda com os presentes Termos de Uso. Caso não concorde com qualquer condição aqui descrita, recomendamos que não utilize os serviços disponibilizados.</p>
               
               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">1. Sobre a Plataforma</h3>
               <p>A {siteName} é uma plataforma digital de divulgação, gerenciamento e comercialização de eventos, disponível via website e aplicativos para dispositivos móveis.</p>
               <p>A plataforma permite que usuários descubram eventos, sigam empresas e perfis públicos, adquiram ingressos e interajam com conteúdos relacionados aos eventos cadastrados.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">2. Cadastro e Uso da Plataforma</h3>
               <p>O uso da plataforma é permitido para qualquer pessoa, sem idade mínima obrigatória.</p>
               <p>Para utilizar determinadas funcionalidades, poderá ser necessário realizar cadastro com informações verdadeiras, completas e atualizadas.</p>
               <p><strong>O usuário é responsável por:</strong></p>
               <ul className="list-disc pl-5">
                  <li>Manter a segurança de sua conta;</li>
                  <li>Não compartilhar credenciais de acesso;</li>
                  <li>Garantir a veracidade das informações fornecidas.</li>
               </ul>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">3. Perfis e Privacidade</h3>
               <p>A plataforma disponibiliza perfis públicos contendo informações como: nome, foto de perfil e informações públicas cadastradas.</p>
               <p>A plataforma permite seguir pessoas e empresas. Essas informações de relacionamento não são exibidas publicamente para outros usuários.</p>
               <p>A utilização dos dados pessoais ocorre conforme a legislação aplicável e políticas internas da plataforma.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">4. Criação de Eventos</h3>
               <p>Somente empresas ou produtores com cadastro verificado poderão criar eventos na plataforma para fins comerciais.</p>
               <p>Os organizadores são integralmente responsáveis pelas informações dos eventos, pela legalidade, pela realização e pelos ingressos emitidos.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">5. Ingressos, Pagamentos e Reembolsos</h3>
               <p>A plataforma comercializa ingressos digitais. Os pagamentos são processados por parceiros financeiros seguros (Stripe).</p>
               <p>Cancelamentos e reembolsos seguem a política específica de cada evento e os prazos legais de arrependimento (7 dias) para compras online.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">6. Contato</h3>
               <p>Em caso de dúvidas sobre os termos, entre em contato:</p>
               <ul className="list-none p-0 space-y-2">
                  <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-secondary" /> <strong>E-mail:</strong> suporte@viby.club</li>
               </ul>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">7. Foro</h3>
               <p>Fica eleito o foro da comarca de Porto Alegre/RS para resolução de quaisquer disputas judiciais relativas ao uso desta plataforma.</p>
            </CardContent>
         </Card>
      </main>

      <Footer />
    </div>
  )
}
