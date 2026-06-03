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
  ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Input } from "@/components/ui/input"
import Link from "next/link"

const FAQ_DATA = [
  {
    category: "Conta e Perfil",
    icon: User,
    items: [
      { q: "Como alterar meu nome de usuário?", a: "Atualmente não é possível alterar o nome de usuário após a criação da conta." },
      { q: "Como editar meu perfil?", a: "Acesse seu perfil e clique em “Editar perfil” para alterar foto, bio e outras informações públicas." },
      { q: "Posso seguir meu próprio perfil?", a: "Não. No seu próprio perfil aparecerá a opção “Editar perfil”." },
      { q: "Meu perfil é público?", a: "Sim. Algumas informações do perfil são públicas para facilitar conexões e descoberta de eventos." },
      { q: "Quais informações do meu perfil ficam privadas?", a: "A Viby não exibe informações sensíveis como histórico completo de eventos frequentados, interesses privados ou dados pessoais protegidos pela LGPD." },
      { q: "Como excluir minha conta?", a: "Você pode solicitar a exclusão da conta nas configurações do perfil. Alguns dados podem permanecer armazenados por obrigação legal." },
      { q: "Esqueci minha senha. O que faço?", a: "Use a opção “Esqueci minha senha” na tela de login para redefinir seu acesso." },
      { q: "Posso usar a mesma conta em mais de um dispositivo?", a: "Sim. Você pode acessar sua conta em diferentes dispositivos simultaneamente." }
    ]
  },
  {
    category: "Ingressos",
    icon: Ticket,
    items: [
      { q: "Como cancelar um ingresso?", a: "Entre na sua página de ingressos e solicite o cancelamento conforme as regras definidas pelo organizador do evento." },
      { q: "Posso transferir meu ingresso para outra pessoa?", a: "Depende das regras do organizador do evento. Alguns ingressos permitem transferência e outros não." },
      { q: "Onde encontro meus ingressos?", a: "Todos os ingressos ficam disponíveis na área “Meus ingressos”." },
      { q: "Meu QR Code não aparece. O que faço?", a: "Atualize a página ou verifique sua conexão com a internet. Se o problema continuar, entre em contato com o suporte." },
      { q: "O ingresso é enviado por e-mail?", a: "Sim. Após a confirmação do pagamento, você receberá os detalhes do ingresso por e-mail." },
      { q: "Posso comprar mais de um ingresso?", a: "Sim. A quantidade máxima depende das regras definidas pelo organizador do evento." },
      { q: "O que acontece se o evento for cancelado?", a: "O organizador será responsável pelas informações de reembolso e cancelamento conforme as políticas aplicáveis." },
      { q: "Meu pagamento foi aprovado mas o ingresso não apareceu.", a: "Aguarde alguns minutos e atualize a página. Caso continue indisponível, entre em contato com o suporte." }
    ]
  },
  {
    category: "Eventos",
    icon: Calendar,
    items: [
      { q: "Como criar um evento?", a: "Acesse sua conta de produtor e clique em “Criar evento”." },
      { q: "Quem pode criar eventos na Viby?", a: "Empresas, produtores independentes, artistas, coletivos, ONGs e organizadores em geral." },
      { q: "Posso editar um evento após publicar?", a: "Sim. Algumas informações podem ser alteradas até o início das vendas ou conforme as regras da plataforma." },
      { q: "Posso excluir um evento?", a: "Sim. Eventos removidos deixam de aparecer publicamente, mas podem permanecer disponíveis na área administrativa." },
      { q: "Como funciona a aprovação de organizações marcadas no evento?", a: "Quando uma organização ou artista é marcado, ele pode aceitar ou recusar a vinculação ao evento." },
      { q: "A Viby organiza os eventos?", a: "Não. A Viby é uma plataforma de divulgação e venda de ingressos. Cada organizador é responsável pelo próprio evento." },
      { q: "Posso criar eventos gratuitos?", a: "Sim. A plataforma permite eventos gratuitos e pagos." },
      { q: "Existe limite de ingressos?", a: "O limite depende da capacidade configurada pelo organizador do evento." }
    ]
  },
  {
    category: "Pagamentos e Taxas",
    icon: CreditCard,
    items: [
      { q: "Quais formas de pagamento são aceitas?", a: "Os métodos disponíveis podem incluir PIX, cartão de crédito e outros meios compatíveis com a plataforma." },
      { q: "Existe taxa na compra de ingressos?", a: "Sim. Uma taxa administrativa pode ser aplicada no momento da compra." },
      { q: "A taxa administrativa é reembolsável?", a: "Depende das regras do evento e das políticas aplicáveis ao cancelamento." },
      { q: "Quando o produtor recebe o valor das vendas?", a: "Os repasses seguem o cronograma definido pela plataforma e pelas regras do organizador." },
      { q: "Posso parcelar meu ingresso?", a: "Alguns eventos permitem parcelamento conforme o valor e as condições disponíveis." }
    ]
  },
  {
    category: "Segurança e Acesso",
    icon: ShieldCheck,
    items: [
      { q: "Como funciona o check-in do evento?", a: "O ingresso possui um QR Code único que será validado na entrada do evento." },
      { q: "Posso usar print do ingresso?", a: "Sim, desde que o QR Code esteja legível." },
      { q: "Meu ingresso pode ser usado mais de uma vez?", a: "Não. Após o check-in, o ingresso é invalidado automaticamente." },
      { q: "A Viby compartilha meus dados pessoais?", a: "Não. Os dados são tratados conforme a LGPD e utilizados apenas para funcionamento da plataforma e dos eventos." },
      { q: "Como denunciar um evento ou perfil?", a: "Você pode usar a opção “Denunciar” disponível no perfil ou página do evento." }
    ]
  },
  {
    category: "Plataforma",
    icon: Globe,
    items: [
      { q: "A Viby é gratuita?", a: "Sim. Criar uma conta e explorar eventos é gratuito." },
      { q: "A Viby possui aplicativo?", a: "A disponibilidade de aplicativo pode variar conforme a versão atual da plataforma." },
      { q: "Como entro em contato com o suporte?", a: "Você pode acessar a área de suporte diretamente pela plataforma." },
      { q: "Posso divulgar minha organização na Viby?", a: "Sim. Organizações, coletivos, artistas e empresas podem criar perfis públicos." },
      { q: "A Viby verifica perfis?", a: "Alguns perfis podem receber selo de verificação conforme critérios da plataforma." },
      { q: "O que significa seguir um perfil?", a: "Seguir um perfil ajuda você a acompanhar eventos, novidades e conteúdos publicados por aquele usuário ou organização." }
    ]
  }
]

export default function FAQPage() {
  const router = useRouter()
  const [search, setSearch] = React.useState("")

  const filteredFaq = React.useMemo(() => {
    if (!search) return FAQ_DATA
    return FAQ_DATA.map(category => ({
      ...category,
      items: category.items.filter(item => 
        item.q.toLowerCase().includes(search.toLowerCase()) || 
        item.a.toLowerCase().includes(search.toLowerCase())
      )
    })).filter(category => category.items.length > 0)
  }, [search])

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-6 text-center md:text-left md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
              <HelpCircle className="w-8 h-8 text-secondary" />
              Central de Ajuda
            </h1>
            <p className="text-muted-foreground font-medium">Tire suas dúvidas sobre a plataforma.</p>
          </div>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar ajuda..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl border-dashed border-secondary/30 focus-visible:ring-secondary/30"
          />
        </div>
      </div>

      {/* Categories & Accordions */}
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
             <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Nenhum resultado para "{search}"</p>
             <Button variant="link" className="mt-2 text-secondary font-bold" onClick={() => setSearch("")}>Limpar Busca</Button>
          </div>
        )}
      </div>

      {/* Footer Contact */}
      <Card className="border-none shadow-xl rounded-[2.5rem] bg-primary text-white overflow-hidden relative">
        <CardContent className="p-10 flex flex-col md:flex-row items-center gap-8 justify-between relative z-10">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-2xl font-black italic uppercase tracking-tighter">Não achou o que precisava?</h3>
            <p className="text-sm opacity-70 font-medium">Nossa equipe de suporte está pronta para te atender.</p>
          </div>
          <Button asChild className="bg-secondary text-white font-black h-14 px-10 rounded-2xl shadow-xl shadow-secondary/20 uppercase italic transition-all hover:scale-105 gap-2">
            <Link href="/dashboard/suporte">
              <MessageCircle className="w-5 h-5" />
              Falar com Suporte
            </Link>
          </Button>
        </CardContent>
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl" />
      </Card>
    </div>
  )
}
