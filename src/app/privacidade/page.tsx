import * as React from "react"
import { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, ShieldCheck, Mail, MapPin, User, Lock, Eye } from "lucide-react"
import Footer from "@/components/layout/Footer"
import { getAdminDb } from "@/lib/firebase/admin"

const VIBY_CAPA = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibycapa.jpeg?alt=media&token=352689b1-73e0-409b-ad29-e1c5e660bac0";

export const metadata: Metadata = {
  title: 'Política de Privacidade | Proteção de Dados Viby',
  description: 'Saiba como a Viby protege seus dados e garante a segurança da sua identidade digital e transações em conformidade com a LGPD.',
  keywords: ['privacidade', 'segurança de dados', 'lgpd viby', 'proteção ao usuário'],
  alternates: { canonical: 'https://viby.club/privacidade' },
  openGraph: {
    title: 'Privacidade e Proteção de Dados | Viby',
    description: 'Compromisso com a segurança e transparência no tratamento dos seus dados pessoais.',
    url: 'https://viby.club/privacidade',
    siteName: 'Viby',
    type: 'website',
    locale: 'pt_BR',
    images: [{ url: VIBY_CAPA, width: 1200, height: 630 }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privacidade Viby',
    description: 'Como cuidamos da sua segurança digital.',
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

export default async function PoliticaPrivacidadePage() {
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
            <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-primary">Política de <span className="text-secondary">Privacidade</span></h1>
            <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">Última atualização: 19 de maio de 2026</p>
         </div>

         <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
            <CardContent className="p-8 md:p-12 prose prose-slate max-w-none text-sm md:text-base leading-relaxed font-medium">
               <p>A presente Política de Privacidade descreve como a {siteName} coleta, utiliza, armazena e protege os dados dos usuários que acessam a plataforma, seus aplicativos e serviços relacionados. Ao utilizar a plataforma, você concorda com os termos desta Política.</p>
               
               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">1. Dados Coletados</h3>
               <p><strong>Dados de cadastro:</strong> Nome, e-mail, foto de perfil, data de nascimento, CPF, CNPJ, endereço e informações comerciais.</p>
               <p><strong>Dados de utilização:</strong> Eventos visualizados, interações, histórico de compras, acessos, dispositivo, IP, localização aproximada e preferências.</p>
               <p><strong>Dados financeiros:</strong> Os pagamentos são processados por parceiros externos (Stripe). A {siteName} não armazena dados completos de cartões bancários.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">2. Como os Dados São Utilizados</h3>
               <p>Os dados poderão ser utilizados para: funcionamento da plataforma, autenticação, processamento de pagamentos, prevenção a fraudes, análise de comportamento, personalização de conteúdo, recomendações de eventos, comunicação direta e cumprimento de obrigações legais.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">3. Perfis Públicos</h3>
               <p>A plataforma disponibiliza perfis públicos contendo: nome, foto de perfil e informações públicas cadastradas. As relações de seguidores entre usuários e empresas não são exibidas publicamente para terceiros.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">4. Compartilhamento de Dados</h3>
               <p>A {siteName} poderá compartilhar informações com processadores de pagamento, serviços antifraude, fornecedores tecnológicos e autoridades judiciais. A plataforma não comercializa dados pessoais dos usuários.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">5. Cookies e Rastreamento</h3>
               <p>Utilizamos cookies, pixels e ferramentas analíticas para auxiliar na segurança, desempenho e personalização da experiência do usuário.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">6. Armazenamento e Segurança</h3>
               <p>Adotamos medidas técnicas e organizacionais para proteção das informações. Apesar dos esforços, nenhum sistema é completamente imune a falhas ou ataques cibernéticos.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">7. Direito do Usuário</h3>
               <p>O usuário poderá solicitar: acesso, atualização, correção ou exclusão de seus dados, bem como a revogação de consentimentos, respeitando obrigações legais e prevenções a fraude.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">8. Retenção de Dados</h3>
               <p>Os dados são mantidos enquanto a conta estiver ativa, houver necessidade operacional ou existirem obrigações legais e auditorias pendentes.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">9. Menores de Idade</h3>
               <p>A plataforma não possui idade mínima obrigatória. Usuários menores de idade devem utilizar os serviços sob responsabilidade de seus responsáveis legais.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">10. Transferência Internacional</h3>
               <p>Alguns serviços utilizados podem armazenar ou processar informações em servidores fora do Brasil. Ao utilizar a plataforma, o usuário concorda com essa possibilidade.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">11. Contato</h3>
               <p>Para dúvidas ou solicitações relacionadas à privacidade:</p>
               <ul className="list-none p-0 space-y-2">
                  <li className="flex items-center gap-2"><User className="w-4 h-4 text-secondary" /> <strong>Responsável:</strong> Viby Club</li>
                  <li className="flex items-center gap-2"><MapPin className="w-4 h-4 text-secondary" /> <strong>Localidade:</strong> Porto Alegre, RS</li>
                  <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-secondary" /> <strong>E-mail:</strong> suporte@viby.club</li>
               </ul>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">12. Legislação Aplicável</h3>
               <p>Esta Política é regida pelas leis da República Federativa do Brasil, incluindo a Lei Geral de Proteção de Dados Pessoais (LGPD).</p>
            </CardContent>
         </Card>
      </main>

      <Footer />
    </div>
  )
}
