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
            <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-primary">Termos de <span className="text-secondary">Uso</span></h1>
            <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">Última atualização: 11 de julho de 2026</p>
         </div>

         <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
            <CardContent className="p-8 md:p-12 prose prose-slate max-w-none text-sm md:text-base leading-relaxed font-medium">
               <p>Bem-vindo(a) à <strong>{siteName}</strong>! Nosso objetivo é conectar você às melhores experiências da sua região. <em>Descubra. Viva. Compartilhe. Viby.</em></p>
               
               <p>Este documento ("Termos de Uso") estabelece as regras para a utilização do site <a href="https://viby.club/" target="_blank" rel="noopener noreferrer">viby.club</a>, bem como dos serviços e ferramentas oferecidos pela plataforma. Ao acessar, se cadastrar, comprar ingressos ou criar eventos na {siteName}, você concorda integralmente com estes Termos. Leia com atenção.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">1. O Papel da Plataforma {siteName}</h3>
               <p>A {siteName} é uma plataforma tecnológica que atua exclusivamente como <strong>intermediadora</strong> na gestão e venda de ingressos online.</p>
               <ul className="list-disc pl-6 space-y-2">
                  <li>Não somos produtores, organizadores ou donos dos eventos divulgados.</li>
                  <li>A idealização, produção, execução, cumprimento de horários, alvarás, segurança e a entrega do que foi prometido no evento são de responsabilidade <strong>integral e exclusiva do Organizador do evento</strong>.</li>
               </ul>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">2. Cadastro e Conta de Usuário</h3>
               <p>Para comprar ingressos ou criar eventos, você precisará criar uma conta.</p>
               <ul className="list-disc pl-6 space-y-2">
                  <li>Você é responsável por fornecer informações exatas, atualizadas e verdadeiras.</li>
                  <li>A senha da sua conta é pessoal e intransferível. A {siteName} não se responsabiliza por compras ou acessos indevidos realizados por terceiros que tenham obtido acesso à sua conta por falha na guarda da sua senha.</li>
                  <li>A plataforma reserva-se o direito de suspender ou banir contas que violem estes Termos, pratiquem fraudes ou atividades ilícitas.</li>
               </ul>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">3. Compra de Ingressos e Taxas de Serviço</h3>
               <p>Ao adquirir um ingresso através da {siteName}, aplicam-se as seguintes regras financeiras:</p>
               <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Taxa de Conveniência:</strong> A {siteName} cobra uma taxa de serviço (taxa de conveniência) sobre o valor de cada ingresso vendido. Esta taxa é exibida de forma clara e transparente no carrinho antes da finalização da compra e remunera a plataforma pelo serviço tecnológico de emissão, gestão do ingresso e infraestrutura.</li>
                  <li><strong>Processamento:</strong> As transações financeiras são processadas por um gateway de pagamento parceiro (Stripe) em ambiente seguro. A {siteName} não armazena os dados completos do seu cartão de crédito.</li>
                  <li><strong>Ingresso Digital:</strong> Após a confirmação do pagamento, o ingresso ficará disponível na sua conta {siteName}, contendo um QR Code único para validação na portaria do evento. A guarda e o sigilo desse QR Code são de responsabilidade do comprador.</li>
               </ul>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">4. Política de Reembolso e Cancelamento de Ingressos (Compradores)</h3>
               <p>A {siteName} respeita o Código de Defesa do Consumidor (CDC) e estabelece as seguintes regras para estornos:</p>
               <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Arrependimento da Compra:</strong> O comprador tem o direito de solicitar o cancelamento e o reembolso integral do valor do ingresso em até <strong>7 (sete) dias corridos</strong> após a data da compra.</li>
                  <li><strong>Prazo Limite (A Regra das 48 Horas):</strong> Para garantir a integridade do planejamento do evento e evitar fraudes, a solicitação de reembolso por arrependimento só será processada automaticamente se efetuada com, no mínimo, <strong>48 horas de antecedência</strong> do horário oficial de início do evento.</li>
                  <li><strong>Solicitações Fora do Prazo:</strong> Pedidos de estorno realizados após o prazo de 7 dias da compra, ou solicitados a menos de 48 horas do início do evento, perdem o direito ao processamento automático. Nestes casos, a solicitação será encaminhada para análise manual do Organizador do evento, que terá a decisão exclusiva de aprovar ou recusar o estorno, isentando a {siteName} de qualquer responsabilidade sobre essa decisão.</li>
                  <li><strong>Prazo de Devolução:</strong> O estorno aprovado será realizado na mesma forma de pagamento utilizada. Para compras em cartão de crédito, o valor pode levar de 1 a 2 faturas para ser creditado, dependendo da administradora do cartão.</li>
               </ul>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">5. Termos Adicionais para Organizadores e Produtores de Eventos</h3>
               <p>Se você utiliza a {siteName} para criar e gerenciar eventos, aplicam-se obrigatoriamente as seguintes regras de negócio:</p>
               <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Responsabilidade sobre o Evento:</strong> O Organizador assume total responsabilidade legal, civil e criminal sobre o evento, garantindo que possui todas as autorizações, alvarás e licenças necessárias para a sua realização.</li>
                  <li><strong>Cancelamento, Adiamento ou Alteração do Evento:</strong> Caso o evento seja cancelado, adiado ou sofra alterações substanciais (como mudança de local, atração principal ou horário) por decisão ou falha do Organizador, este se torna o <strong>único responsável legal e financeiro</strong> pelo reembolso integral de todos os compradores afetados.</li>
                  <li><strong>Retenção de Taxas:</strong> Em caso de cancelamento do evento ou reembolsos em massa motivados pelo Organizador, <strong>as taxas de conveniência da plataforma {siteName} e os custos de processamento financeiro do gateway não são reembolsáveis ao Organizador</strong>. A plataforma executou o serviço de tecnologia e intermediação.</li>
                  <li><strong>Débito de Saldo:</strong> O Organizador autoriza expressamente a {siteName} e o gateway de pagamento a debitarem do seu saldo (ou do método de pagamento cadastrado em sua conta vinculada/Stripe Connect) os valores correspondentes aos estornos totais exigidos pelos compradores, acrescidos dos custos operacionais da transação que falhou.</li>
                  <li><strong>Chargebacks (Contestações):</strong> O Organizador reconhece que é o responsável financeiro por eventuais contestações de compras (chargebacks) realizadas pelos compradores. A {siteName} repassará os custos do chargeback e as multas aplicadas pelo gateway diretamente ao saldo do Organizador.</li>
               </ul>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">6. Propriedade Intelectual</h3>
               <p>Todos os direitos autorais, marcas, layout, códigos, softwares e identidade visual ("Descubra. Viva. Compartilhe. Viby.") presentes no site são de propriedade exclusiva da {siteName}. É estritamente proibida a cópia, reprodução ou engenharia reversa de qualquer parte da plataforma sem autorização prévia.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">7. Limitação de Responsabilidade</h3>
               <p>A {siteName} envidará os melhores esforços para manter a plataforma sempre no ar e livre de falhas técnicas. No entanto, não garantimos que o serviço será ininterrupto ou isento de erros. Não nos responsabilizamos por perdas de lucros, dados ou danos indiretos decorrentes do uso da plataforma ou da impossibilidade de utilizá-la.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">8. Atualizações dos Termos</h3>
               <p>A {siteName} poderá alterar estes Termos de Uso a qualquer momento, para refletir melhorias no sistema ou mudanças na legislação aplicável. As alterações entrarão em vigor assim que publicadas nesta página. Recomendamos que os usuários revisem os Termos periodicamente. O uso contínuo da plataforma após as alterações significa a aceitação dos novos Termos.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">9. Contato e Suporte</h3>
               <p>Ficou com alguma dúvida sobre estes Termos de Uso, sobre uma compra ou sobre o repasse do seu evento? Nossa equipe está pronta para ajudar.</p>
               <ul className="list-none p-0 space-y-2">
                  <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-secondary" /> <strong>E-mail:</strong> viby@viby.club</li>
               </ul>
            </CardContent>
         </Card>
      </main>

      <Footer />
    </div>
  )
}
