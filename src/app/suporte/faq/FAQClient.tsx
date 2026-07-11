"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { 
  ArrowLeft, 
  HelpCircle, 
  User, 
  Ticket, 
  Calendar, 
  CreditCard, 
  ShieldCheck, 
  Globe, 
  MessageCircle,
  Search,
  ChevronRight,
  Building2,
  Zap,
  Info
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { useTranslation } from "@/i18n/i18n-context"

const FAQ_DATA_PT = [
  {
    category: "Sobre a Viby",
    categoryKey: "platform",
    icon: Globe,
    items: [
      { q: "O que é a Viby?", a: "A Viby é uma plataforma de divulgação de eventos, venda de ingressos e gestão de participantes. Organizadores podem criar eventos gratuitos ou pagos, vender ingressos online e realizar check-in dos participantes de forma ágil." },
      { q: "Quem pode criar eventos na Viby?", a: "Qualquer pessoa física, empresa, ONG, coletivo, artista, produtor ou instituição pode criar eventos na plataforma." },
      { q: "Preciso ter CNPJ para vender ingressos?", a: "Não. A Viby permite que tanto pessoas físicas quanto jurídicas recebam pagamentos pelos seus eventos." }
    ]
  },
  {
    category: "Criação de Eventos",
    categoryKey: "events",
    icon: Calendar,
    items: [
      { q: "Como criar um evento?", a: "Após criar sua conta, basta acessar o painel da plataforma, cadastrar sua organização e criar seu evento informando descrição, localização, datas, categorias de ingressos e demais informações relevantes." },
      { q: "Posso criar eventos gratuitos?", a: "Sim. Eventos gratuitos podem ser publicados sem nenhuma cobrança de taxas pela plataforma." },
      { q: "Posso vender ingressos pagos?", a: "Sim. A Viby permite a venda de ingressos pagos com processamento seguro e automatizado através da nossa parceira financeira, a Stripe." }
    ]
  },
  {
    category: "Pagamentos e Taxas",
    categoryKey: "payments",
    icon: CreditCard,
    items: [
      { q: "Como recebo o dinheiro das vendas?", a: "Os pagamentos são processados através da Stripe Connect. Após a venda e a realização do evento, os valores são repassados diretamente para a conta bancária cadastrada pelo organizador, conforme os prazos e regras de liquidação." },
      { q: "Preciso verificar minha conta para receber pagamentos?", a: "Sim. A liberação das funcionalidades de recebimento e repasse financeiro depende da conclusão da verificação de identidade e conta junto à Stripe." },
      { q: "Existem taxas na Viby?", a: "Eventos gratuitos não possuem taxas. Para eventos pagos, a Viby trabalha com uma comissão padrão sobre as vendas." },
      { q: "O que é a taxa de serviço?", a: "A taxa de serviço é paga pelo comprador final e cobre os custos relacionados ao processamento do pagamento, emissão dos ingressos digitais, infraestrutura de tecnologia da plataforma, suporte e segurança antifraude das transações." },
      { q: "O que é a comissão da Viby?", a: "A comissão da Viby é a taxa padrão aplicada ao organizador para remunerar os serviços da plataforma, incluindo tecnologia, gestão de vendas e suporte operacional." },
      { q: "Existem taxas personalizadas?", a: "Sim. Dependendo da escala do evento, do organizador, de campanhas comerciais ou de condições específicas, taxas personalizadas podem ser negociadas e aplicadas." }
    ]
  },
  {
    category: "Ingressos e Acesso",
    categoryKey: "tickets",
    icon: Ticket,
    items: [
      { q: "Como recebo meus ingressos?", a: "Após a confirmação do pagamento, os ingressos digitais ficam imediatamente disponíveis na sua conta dentro da plataforma Viby." },
      { q: "O ingresso possui QR Code?", a: "Sim. Todos os ingressos geram um QR Code exclusivo para validação na portaria do evento." },
      { q: "Posso apresentar o ingresso pelo celular?", a: "Sim. A Viby é digital! Não é necessário imprimir o ingresso, basta apresentar a tela do seu celular no momento do check-in." },
      { q: "O QR Code pode ser utilizado mais de uma vez?", a: "Não. Cada ingresso possui uma identificação única e, após a primeira leitura na portaria, ele é invalidado para novos acessos." },
      { q: "Como funciona o check-in?", a: "O organizador pode realizar o check-in dos participantes de três formas através das nossas ferramentas: leitura rápida do QR Code, busca manual pelo nome do participante ou digitando o código exclusivo de 16 caracteres impresso no ingresso." },
      { q: "Como funcionam os reembolsos?", a: "O comprador pode solicitar o cancelamento e reembolso integral em até 7 dias corridos após a compra, desde que a solicitação seja feita com pelo menos 48 horas de antecedência do início do evento (reembolso automático). Solicitações fora deste prazo são enviadas para a análise e aprovação manual do Organizador. Para mais detalhes, consulte nossa Política de Reembolso." },
      { q: "Posso cancelar o evento e os ingressos vendidos?", a: "Sim, o organizador tem total controle para cancelar o evento. No entanto, em caso de cancelamento motivado pela organização, os custos de processamento financeiro não são estornados e ficam sob responsabilidade do produtor." },
      { q: "Posso transferir meu ingresso para outra pessoa?", a: "Sim. A transferência de titularidade pode ser realizada informando os dados necessários do novo participante, incluindo um documento de identificação válido no seu país (como o CPF para residentes no Brasil, ou Passaporte/Documento Nacional para outros países)." },
      { q: "Preciso criar uma conta para comprar ingressos?", a: "Sim. Para garantir a segurança da transação e o armazenamento correto do seu QR Code, é necessário possuir uma conta na Viby." }
    ]
  },
  {
    category: "Segurança e Suporte",
    categoryKey: "security",
    icon: ShieldCheck,
    items: [
      { q: "Posso seguir organizações e acompanhar eventos?", a: "Sim. Você pode seguir seus produtores favoritos e acompanhar em primeira mão os novos eventos publicados por eles." },
      { q: "Meus dados estão seguros?", a: "Sim. A Viby utiliza tecnologias de criptografia de ponta e provedores especializados para proteger suas informações. Seus dados de pagamento não ficam armazenados em nossos servidores, sendo processados diretamente pela Stripe." },
      { q: "Como entro em contato com o suporte?", a: "O suporte oficial da Viby está disponível diretamente pelo painel da plataforma, acessando o menu 'Suporte'." }
    ]
  }
]

const FAQ_DATA_EN = [
  {
    category: "About Viby",
    categoryKey: "platform",
    icon: Globe,
    items: [
      { q: "What is Viby?", a: "Viby is a platform for event promotion, ticket sales, and participant management. Organizers can create free or paid events, sell tickets online, and perform participant check-in." },
      { q: "Who can create events on Viby?", a: "Any individual, company, NGO, collective, artist, producer, or institution can create events on the platform." },
      { q: "Do I need a Business ID (CNPJ) to sell tickets?", a: "No. Viby allows individuals and legal entities to receive payments for their events." }
    ]
  },
  {
    category: "Event Creation",
    categoryKey: "events",
    icon: Calendar,
    items: [
      { q: "How to create an event?", a: "After creating your account, just access the platform panel, register your organization and create your event by providing description, location, dates, tickets and other information." },
      { q: "Can I create free events?", a: "Yes. Free events can be published without platform fees." },
      { q: "Can I sell paid tickets?", a: "Yes. Viby allows paid ticket sales with secure processing through Stripe." }
    ]
  },
  {
    category: "Payments and Fees",
    categoryKey: "payments",
    icon: CreditCard,
    items: [
      { q: "How do I receive money from sales?", a: "Payments are processed through Stripe Connect. After the sale, values are transferred directly to the account registered by the organizer, following Stripe's terms and rules." },
      { q: "Do I need to verify my account to receive payments?", a: "Yes. Some payout features depend on completing account verification with Stripe." },
      { q: "Are there fees on Viby?", a: "Free events have no fees. For paid events, service fees to the buyer and commissions to the organizer may apply, according to event and platform settings." },
      { q: "What is the service fee?", a: "The service fee covers costs related to payment processing, digital ticket issuance, platform infrastructure, support, and transaction security." },
      { q: "What is Viby's commission?", a: "Viby's commission remunerates platform services, including promotion, technology, ticket sales, event management, and operational support." },
      { q: "Are there custom fees?", a: "Yes. Depending on the event, organizer, commercial campaign, or specific conditions, custom fees may be applied." }
    ]
  },
  {
    category: "Tickets and Access",
    categoryKey: "tickets",
    icon: Ticket,
    items: [
      { q: "How do I receive my tickets?", a: "After payment confirmation, tickets become available in your account within the platform." },
      { q: "Does the ticket have a QR Code?", a: "Yes. All tickets have a unique QR Code for validation." },
      { q: "Can I show the ticket on my phone?", a: "Yes. There is no need to print the ticket." },
      { q: "Can the QR Code be used more than once?", a: "No. Each ticket has a unique identification and validation control." },
      { q: "How does check-in work?", a: "The organizer can perform check-in in three ways: QR Code reading, manual attendee search, or an exclusive 16-character code." },
      { q: "Can I cancel a ticket?", a: "Yes. The organizer can cancel tickets according to the rules defined for the event." },
      { q: "How do refunds work?", a: "When applicable, refunds are processed through Stripe according to event and organizer policies." },
      { q: "Can I transfer my ticket to another person?", a: "Yes. The transfer can be performed by providing the necessary data for the new participant, including Tax ID (CPF)." },
      { q: "Do I need to create an account to buy tickets?", a: "Yes. Currently, it is necessary to have a Viby account to make purchases and access your tickets." }
    ]
  },
  {
    category: "Security and Support",
    categoryKey: "security",
    icon: ShieldCheck,
    items: [
      { q: "Can I follow organizations and track events?", a: "Yes. You can follow organizations and track their events published on the platform." },
      { q: "Is my data safe?", a: "Yes. Viby uses security technologies and specialized providers to protect information and process payments." },
      { q: "How do I contact support?", a: "Viby's official support is available directly through the platform panel in the Support menu." },
      { q: "I didn't find my answer. What do I do?", a: "Contact platform support and our team will help you." }
    ]
  }
]

export default function FAQClient() {
  const { t, language } = useTranslation()
  const router = useRouter()
  const [search, setSearch] = React.useState("")

  const faqData = language === 'en-US' ? FAQ_DATA_EN : FAQ_DATA_PT

  const filteredFaq = React.useMemo(() => {
    if (!search) return faqData
    return faqData.map(category => ({
      ...category,
      items: category.items.filter(item => 
        item.q.toLowerCase().includes(search.toLowerCase()) || 
        item.a.toLowerCase().includes(search.toLowerCase())
      )
    })).filter(category => category.items.length > 0)
  }, [search, faqData])

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-6 text-center md:text-left md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
              <HelpCircle className="w-8 h-8 text-secondary" />
              {t('support.title')}
            </h1>
            <p className="text-muted-foreground font-medium">{t('support.subtitle')}</p>
          </div>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder={t('support.search_placeholder')} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl border-dashed border-secondary/30 focus-visible:ring-secondary/30"
          />
        </div>
      </div>

      <div className="space-y-10">
        {filteredFaq.length > 0 ? filteredFaq.map((category, idx) => (
          <section key={idx} className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                <category.icon className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary">{category.category}</h2>
            </div>

            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
              <CardContent className="p-0">
                <Accordion type="single" collapsible className="w-full">
                  {category.items.map((item, iIdx) => (
                    <AccordionItem key={iIdx} value={`${idx}-${iIdx}`} className="border-b last:border-b-0 px-6 border-muted/50">
                      <AccordionTrigger className="hover:no-underline text-left py-6 font-bold text-sm text-primary hover:text-secondary transition-colors">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="pb-6 text-sm text-muted-foreground leading-relaxed font-medium">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </section>
        )) : (
          <div className="py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-border shadow-inner">
             <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-muted-foreground opacity-20" />
             </div>
             <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">{t('support.no_results').replace('{search}', search)}</p>
             <Button variant="link" className="mt-2 text-secondary font-bold" onClick={() => setSearch("")}>{t('support.clear_search')}</Button>
          </div>
        )}
      </div>

      <Card className="border-none shadow-xl rounded-[2.5rem] bg-primary text-white overflow-hidden relative">
        <CardContent className="p-10 flex flex-col md:flex-row items-center gap-8 justify-between relative z-10">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-2xl font-black italic uppercase tracking-tighter">{t('support.not_found_title')}</h3>
            <p className="text-sm opacity-70 font-medium">{t('support.not_found_desc')}</p>
          </div>
          <Button asChild className="bg-secondary text-white font-black h-14 px-10 rounded-2xl shadow-xl shadow-secondary/20 uppercase italic transition-all hover:scale-105 gap-2">
            <Link href="/suporte">
              <MessageCircle className="w-5 h-5" />
              {t('support.contact_btn')}
            </Link>
          </Button>
        </CardContent>
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl" />
      </Card>
    </div>
  )
}
