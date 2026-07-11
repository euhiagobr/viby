import * as React from "react"
import { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Mail } from "lucide-react"
import Footer from "@/components/layout/Footer"
import { getAdminDb } from "@/lib/firebase/admin"

const VIBY_CAPA = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibycapa.jpeg?alt=media&token=352689b1-73e0-409b-ad29-e1c5e660bac0";

export const metadata: Metadata = {
  title: 'Política de Cancelamento e Reembolso | Viby',
  description: 'Saiba como funciona o processo de cancelamento e reembolso de ingressos na Viby. Transparência, direitos garantidos pelo CDC e ótima experiência.',
  keywords: ['reembolso', 'cancelamento de ingresso', 'política de devolução', 'código de defesa do consumidor', 'cdc viby'],
  alternates: { canonical: 'https://viby.club/reembolso' },
  openGraph: {
    title: 'Política de Cancelamento e Reembolso | Viby',
    description: 'Processo transparente de reembolso com proteção total do consumidor.',
    url: 'https://viby.club/reembolso',
    siteName: 'Viby',
    type: 'website',
    locale: 'pt_BR',
    images: [{ url: VIBY_CAPA, width: 1200, height: 630 }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Reembolso Viby',
    description: 'Cancelamento de ingressos de forma ágil e transparente.',
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

export default async function ReembolsoPage() {
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
            <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-primary">Cancelamento e <span className="text-secondary">Reembolso</span></h1>
            <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">Última atualização: 11 de julho de 2026</p>
         </div>

         <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
            <CardContent className="p-8 md:p-12 prose prose-slate max-w-none text-sm md:text-base leading-relaxed font-medium">
               <p>A <strong>{siteName}</strong> valoriza a transparência e quer que as suas experiências sejam sempre as melhores possíveis (<em>Descubra. Viva. Compartilhe. Viby.</em>). Sabemos que imprevistos acontecem, por isso nossa política de cancelamento e reembolso foi construída para ser justa, ágil e rigorosamente alinhada ao Código de Defesa do Consumidor (CDC).</p>
               
               <p>Leia atentamente as regras abaixo para entender como funcionam os estornos na plataforma.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">1. O Direito de Arrependimento (Reembolso Automático)</h3>
               <p>Em conformidade com o Artigo 49 do Código de Defesa do Consumidor, garantimos a você o direito de se arrepender da compra e solicitar o cancelamento do seu ingresso.</p>
               <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Prazo Legal:</strong> Você tem até <strong>7 (sete) dias corridos</strong>, contados a partir da data da compra, para solicitar o reembolso integral do valor pago (incluindo a taxa de conveniência).</li>
                  <li><strong>A Regra das 48 Horas:</strong> Para garantir a integridade do evento e evitar fraudes, o reembolso automático por arrependimento só será processado se a solicitação for feita com, no mínimo, <strong>48 horas de antecedência</strong> do horário agendado para a abertura dos portões/início do evento.</li>
                  <li><strong>O que acontece?</strong> Atendendo a esses dois requisitos (dentro dos 7 dias da compra e antes das 48h do evento), o sistema da {siteName} cancela o seu ingresso instantaneamente e dispara a ordem de estorno para o seu cartão.</li>
               </ul>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">2. Solicitações Fora do Prazo (Cancelamento Manual)</h3>
               <p>Entendemos que você pode precisar cancelar um ingresso após o período legal de 7 dias ou às vésperas do evento. No entanto, nestes cenários, a {siteName} não pode forçar a devolução do dinheiro.</p>
               <ul className="list-disc pl-6 space-y-2">
                  <li>Pedidos realizados <strong>após 7 dias da compra</strong> ou faltando <strong>menos de 48 horas para o evento</strong> perdem o direito ao processamento automático.</li>
                  <li>Nesses casos, a sua solicitação será enviada diretamente para o painel do <strong>Organizador do evento</strong>.</li>
                  <li>Caberá única e exclusivamente ao Organizador avaliar o seu caso e decidir se aprova a exceção ou recusa o pedido. A {siteName} atua apenas como intermediadora de tecnologia e não tem autonomia legal para interferir nessa decisão.</li>
               </ul>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">3. Cancelamento, Adiamento ou Alteração do Evento</h3>
               <p>Se o evento que você vai participar for cancelado, tiver a data alterada ou sofrer mudanças drásticas em sua estrutura (como mudança de atração principal ou local) por decisão da produção, os seus direitos estão totalmente garantidos.</p>
               <ul className="list-disc pl-6 space-y-2">
                  <li>Neste cenário, a responsabilidade pelo reembolso passa a ser inteiramente do Organizador do evento.</li>
                  <li>A {siteName} efetuará o processamento da devolução integral para todos os compradores afetados assim que receber a autorização formal e os fundos correspondentes por parte do Organizador responsável.</li>
               </ul>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">4. Prazos e Formas de Devolução</h3>
               <p>O reembolso (seja ele automático ou aprovado pelo Organizador) será sempre processado utilizando a mesma forma de pagamento que você escolheu no momento da compra.</p>
               <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Compras via Cartão de Crédito:</strong> O valor estornado será devolvido à administradora do seu cartão de crédito. O prazo para que o limite retorne ou o valor conste como crédito na sua fatura pode variar de <strong>1 a 2 faturas subsequentes</strong>, dependendo exclusivamente da data de fechamento e das regras do banco emissor do seu cartão.</li>
                  <li><strong>Compras via Pix (Quando disponível):</strong> O valor será devolvido diretamente para a conta bancária de origem da transferência (a mesma conta que você usou para pagar o QR Code), geralmente em até 2 dias úteis após a aprovação do estorno.</li>
               </ul>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">5. Como solicitar o seu reembolso</h3>
               <p>O processo é simples e feito diretamente pelo aplicativo ou site:</p>
               <ol className="list-decimal pl-6 space-y-2">
                  <li>Acesse a sua conta na {siteName}.</li>
                  <li>Vá até a aba "Meus Ingressos".</li>
                  <li>Selecione o ingresso do evento que deseja cancelar.</li>
                  <li>Clique no botão <strong>Solicitar Reembolso</strong> e confirme a operação.</li>
                  <li>O sistema informará imediatamente se o seu estorno foi processado automaticamente (seguindo a regra do CDC) ou se foi encaminhado para a análise do Organizador.</li>
               </ol>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">6. Precisa de Ajuda?</h3>
               <p>Se o seu pedido estiver dentro das regras e o reembolso não ocorrer como o esperado, ou se você tiver qualquer dúvida sobre este processo, nossa equipe está pronta para te auxiliar.</p>
               <ul className="list-none p-0 space-y-2">
                  <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-secondary" /> <strong>Suporte:</strong> <a href="https://viby.club/suporte" target="_blank" rel="noopener noreferrer">https://viby.club/suporte</a></li>
               </ul>
            </CardContent>
         </Card>
      </main>

      <Footer />
    </div>
  )
}
