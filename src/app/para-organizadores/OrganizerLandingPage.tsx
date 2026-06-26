"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useFirestore, useDoc } from "@/firebase"
import { collection, addDoc, serverTimestamp, doc } from "firebase/firestore"
import { 
  Ticket, 
  Megaphone, 
  BarChart3, 
  Zap, 
  CreditCard, 
  Smartphone, 
  CheckCircle2, 
  ArrowRight, 
  Loader2,
  HelpCircle,
  MessageCircle,
  Globe,
  Star,
  Users,
  ShieldCheck,
  BadgeCheck
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion"
import { toast } from "@/hooks/use-toast"
import Footer from "@/components/layout/Footer"
import { cn } from "@/lib/utils"

const BENEFITS = [
  { icon: Ticket, title: "Venda de Ingressos", desc: "Receba pagamentos online de forma segura e rápida.", color: "text-blue-500", bg: "bg-blue-50" },
  { icon: Megaphone, title: "Divulgação", desc: "Seus eventos aparecem para pessoas procurando o que fazer.", color: "text-purple-500", bg: "bg-purple-50" },
  { icon: BarChart3, title: "Dashboard Completo", desc: "Acompanhe vendas e participantes em tempo real.", color: "text-green-500", bg: "bg-green-50" },
  { icon: Zap, title: "Publicação Rápida", desc: "Crie e coloque seu evento no ar em poucos minutos.", color: "text-orange-500", bg: "bg-orange-50" },
  { icon: CreditCard, title: "Stripe Connect", desc: "Receba o valor das vendas diretamente na sua conta bancária.", color: "text-secondary", bg: "bg-secondary/5" },
  { icon: Smartphone, title: "Gestão Mobile", desc: "Controle portaria e vendas direto pelo celular.", color: "text-primary", bg: "bg-primary/5" },
];

const STEPS = [
  { number: "01", title: "Crie sua conta", desc: "Cadastre seu perfil pessoal e crie a página da sua marca ou produtora." },
  { number: "02", title: "Configure o Stripe Connect", desc: "Vincule sua conta bancária para receber os valores das vendas de ingressos." },
  { number: "03", title: "Publique seu evento", desc: "Defina local, data, descrição e tipos de ingressos que deseja vender." },
  { number: "04", title: "Acompanhe e Venda", desc: "Divulgue seu link oficial e monitore os resultados no seu painel." },
];

const FEATURES = [
  "Eventos gratuitos", "Eventos pagos", "Cupons de desconto", "Ingressos ilimitados", 
  "QR Code para check-in", "Relatórios de vendas", "Controle de participantes", 
  "Página pública do evento", "Compartilhamento em redes sociais"
];

const FAQS = [
  { q: "Quanto custa vender ingressos pela Viby?", a: "Fale com a equipe da Viby e veja uma taxa personalizada para você!" },
  { q: "Preciso ter CNPJ para vender?", a: "Não. A Viby permite que tanto pessoas físicas (CPF) quanto jurídicas (CNPJ) criem eventos e vendam ingressos." },
  { q: "Como recebo os pagamentos?", a: "Utilizamos o Stripe Connect, um dos processadores de pagamento mais seguros do mundo. O valor líquido das suas vendas é transferido para sua conta bancária conforme o ciclo financeiro escolhido." },
  { q: "Posso criar eventos gratuitos?", a: "Com certeza! A Viby é ideal para gerir listas de presença e convites em eventos sem custo de entrada." },
  { q: "Preciso vender diferentes tipos de ingressos?", a: "Sim. Você pode configurar lotes, ingressos VIP, meia-entrada, promocionais e muito mais." }
];

export default function OrganizerLandingPage() {
  const db = useFirestore()
  const [loading, setLoading] = React.useState(false)
  const [success, setSuccess] = React.useState(false)

  const settingsRef = React.useMemo(() => (db ? doc(db, "settings", "site") : null), [db]);
  const { data: settings } = useDoc<any>(settingsRef);
  const siteName = settings?.siteName || "Viby";

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || loading) return

    setLoading(true)
    const formData = new FormData(e.currentTarget)
    
    const leadData = {
      nome: formData.get("nome") as string,
      empresa: formData.get("empresa") as string,
      cidade: formData.get("cidade") as string,
      whatsapp: formData.get("whatsapp") as string,
      email: formData.get("email") as string,
      instagram: formData.get("instagram") as string,
      tipoEvento: formData.get("tipoEvento") as string,
      publicoMedio: formData.get("publicoMedio") as string,
      mensagem: formData.get("mensagem") as string,
      aceitouContato: true,
      status: "novo",
      createdAt: serverTimestamp()
    }

    try {
      await addDoc(collection(db, "organizer_leads"), leadData)
      setSuccess(true)
      toast({ title: "Solicitação enviada!", description: "Nossa equipe entrará em contato em breve." })
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao enviar", description: "Tente novamente mais tarde." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white">
      {/* NAVBAR */}
      <nav className="fixed top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            {settings?.logoUrl ? (
              <Image src={settings.logoUrl} alt={siteName} width={120} height={40} className="h-8 sm:h-10 w-auto object-contain transition-transform group-hover:scale-105" priority unoptimized />
            ) : (
              <>
                <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center shadow-lg">
                  <span className="text-white font-black text-lg">V</span>
                </div>
                <span className="text-xl font-bold tracking-tight italic uppercase text-primary ml-1">{siteName}</span>
              </>
            )}
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild className="hidden sm:flex font-bold uppercase text-[10px] tracking-widest">
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild className="bg-primary text-white font-black uppercase italic text-[10px] tracking-widest rounded-full px-6 shadow-lg shadow-primary/20">
              <Link href="#contato">Começar Agora</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-white">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[800px] h-[800px] bg-secondary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8 text-center lg:text-left">
              <Badge className="bg-secondary/10 text-secondary border-none px-4 py-1.5 rounded-full font-black uppercase text-[10px] tracking-widest w-fit mx-auto lg:mx-0">
                Solução completa para produtores
              </Badge>
              <h1 className="text-5xl md:text-8xl font-black uppercase italic tracking-tighter leading-[0.85] text-primary">
                VENDA INGRESSOS E <span className="text-secondary">DIVULGUE</span> SEUS EVENTOS
              </h1>
              <p className="text-lg md:text-2xl font-medium text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Crie eventos, venda ingressos online, receba pagamentos com segurança e alcance mais pessoas com a Viby.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <Button asChild className="h-16 px-10 bg-primary text-white font-black rounded-2xl shadow-2xl shadow-primary/20 uppercase italic text-lg hover:scale-105 transition-transform w-full sm:w-auto">
                  <Link href="#contato">Criar meu Evento</Link>
                </Button>
                <Button variant="outline" asChild className="h-16 px-10 rounded-2xl font-black uppercase italic text-lg border-2 w-full sm:w-auto">
                  <Link href="#faq">Falar com Especialista</Link>
                </Button>
              </div>
            </div>
            <div className="relative group perspective-1000">
               <div className="relative z-10 rounded-[3rem] overflow-hidden shadow-2xl border-8 border-white bg-primary aspect-[4/3] rotate-2 group-hover:rotate-0 transition-transform duration-700 flex items-center justify-center p-12 md:p-20">
                  {settings?.logoUrl ? (
                    <Image src={settings.logoUrl} alt={siteName} width={400} height={200} className="w-full h-auto object-contain brightness-0 invert" unoptimized />
                  ) : (
                    <span className="text-white text-9xl font-black italic">{siteName.charAt(0)}</span>
                  )}
               </div>
               <div className="absolute -bottom-6 -left-6 bg-secondary text-white p-8 rounded-[2rem] shadow-2xl z-20 animate-bounce">
                  <BarChart3 className="w-10 h-10" />
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section className="py-24 bg-[#f8fafc]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20 space-y-3">
             <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-primary leading-none">Feito para quem faz acontecer</h2>
             <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest text-secondary">Tudo o que sua produção precisa em um só lugar.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {BENEFITS.map((item, i) => (
              <Card key={i} className="border-none shadow-sm hover:shadow-xl transition-all rounded-[2.5rem] bg-white group hover:-translate-y-1">
                <CardContent className="p-10 space-y-6">
                  <div className={cn("p-4 rounded-2xl w-fit transition-transform group-hover:scale-110", item.bg, item.color)}>
                    <item.icon className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black uppercase italic tracking-tight text-primary leading-tight">{item.title}</h3>
                    <p className="text-sm font-medium text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="py-24 bg-primary text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[120px]" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-20">
             <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter leading-none">Simples, prático e ágil.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            {STEPS.map((step, i) => (
              <div key={i} className="space-y-6 relative group">
                <span className="text-6xl font-black italic text-white/10 group-hover:text-secondary/40 transition-colors duration-500">{step.number}</span>
                <div className="space-y-2">
                   <h3 className="text-xl font-black uppercase italic tracking-tight leading-none">{step.title}</h3>
                   <p className="text-sm font-medium text-white/60 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RECURSOS */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
           <div className="max-w-5xl mx-auto bg-muted/20 rounded-[3rem] p-12 md:p-20 flex flex-col md:flex-row items-center gap-16 border border-border/40">
              <div className="flex-1 space-y-8">
                 <h2 className="text-4xl font-black uppercase italic tracking-tighter text-primary leading-none">Funcionalidades pensadas para escala</h2>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {FEATURES.map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                         <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                         <span className="text-sm font-bold uppercase text-primary/80">{item}</span>
                      </div>
                    ))}
                 </div>
              </div>
              <div className="shrink-0">
                 <div className="w-48 h-48 bg-secondary rounded-full flex items-center justify-center shadow-2xl shadow-secondary/20 rotate-12">
                    <ShieldCheck className="w-24 h-24 text-white" />
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* FORMULÁRIO DE LEADS */}
      <section id="contato" className="py-24 bg-[#f8fafc]">
        <div className="container mx-auto px-4">
           <div className="max-w-4xl mx-auto">
              <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
                 <div className="grid grid-cols-1 md:grid-cols-12">
                    <div className="md:col-span-5 bg-primary p-12 text-white flex flex-col justify-between relative overflow-hidden">
                       <div className="relative z-10 space-y-6">
                          <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-tight">Quer saber como a Viby pode ajudar seu evento?</h2>
                          <p className="text-sm font-medium text-white/60 leading-relaxed uppercase tracking-wide">Preencha o formulário e nossa equipe comercial entrará em contato em menos de 24 horas.</p>
                       </div>
                       <div className="relative z-10 space-y-6">
                          <div className="flex items-center gap-3"><Users className="w-5 h-5 text-secondary" /><span className="text-xs font-bold uppercase tracking-widest">Divulgação e emissão de ingressos</span></div>
                          <div className="flex items-center gap-3"><Star className="w-5 h-5 text-secondary" /><span className="text-xs font-bold uppercase tracking-widest">Plataforma líder em experiência</span></div>
                       </div>
                       <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />
                    </div>
                    <div className="md:col-span-7 p-12">
                       {success ? (
                         <div className="h-full flex flex-col items-center justify-center text-center gap-6 animate-in zoom-in-95 duration-500">
                            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto text-white shadow-xl"><CheckCircle2 className="w-10 h-10" /></div>
                            <div className="space-y-2">
                               <h3 className="text-2xl font-black uppercase italic text-primary">Solicitação Enviada!</h3>
                               <p className="text-sm text-muted-foreground font-medium uppercase leading-relaxed">Obrigado pelo interesse. Em breve um de nossos consultores falará com você.</p>
                            </div>
                            <Button onClick={() => setSuccess(false)} variant="outline" className="rounded-xl font-bold uppercase text-[10px]">Enviar outra dúvida</Button>
                         </div>
                       ) : (
                         <form onSubmit={handleFormSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                               <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">Nome Completo *</Label><Input name="nome" required className="rounded-xl h-11" /></div>
                               <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">Nome da Empresa</Label><Input name="empresa" className="rounded-xl h-11" /></div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                               <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">Cidade *</Label><Input name="cidade" required className="rounded-xl h-11" /></div>
                               <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">WhatsApp *</Label><Input name="whatsapp" required placeholder="(00) 00000-0000" className="rounded-xl h-11" /></div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                               <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">E-mail Corporativo *</Label><Input name="email" type="email" required className="rounded-xl h-11" /></div>
                               <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">Instagram (@)</Label><Input name="instagram" placeholder="@seu_perfil" className="rounded-xl h-11" /></div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                               <div className="space-y-1.5">
                                  <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Tipo de Evento *</Label>
                                  <Select name="tipoEvento" required>
                                     <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                     <SelectContent className="rounded-xl">
                                        {["Festa", "Casa Noturna", "Show", "Festival", "Feira", "Congresso", "Evento Corporativo", "Outro"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                     </SelectContent>
                                  </Select>
                               </div>
                               <div className="space-y-1.5">
                                  <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Público Médio *</Label>
                                  <Select name="publicoMedio" required>
                                     <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                     <SelectContent className="rounded-xl">
                                        {["Até 100", "100 a 500", "500 a 1000", "1000 a 5000", "Mais de 5000"].map(p => <SelectItem key={p} value={p}>{p} pessoas</SelectItem>)}
                                     </SelectContent>
                                  </Select>
                               </div>
                            </div>
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">Mensagem</Label><Textarea name="mensagem" className="rounded-xl resize-none h-24" placeholder="Conte mais sobre suas necessidades..." /></div>
                            
                            <div className="flex items-center space-x-3 bg-muted/20 p-4 rounded-xl">
                               <Checkbox id="terms" name="aceitouContato" required defaultChecked />
                               <label htmlFor="terms" className="text-[10px] font-bold uppercase text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">Concordo em ser contatado pela equipe da Viby</label>
                            </div>

                            <Button type="submit" disabled={loading} className="w-full bg-secondary text-white font-black h-16 rounded-[1.5rem] shadow-xl shadow-secondary/20 uppercase italic text-lg hover:scale-[1.02] transition-transform">
                               {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Quero Conhecer a Viby"}
                            </Button>
                         </form>
                       )}
                    </div>
                 </div>
              </Card>
           </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 bg-white">
        <div className="container mx-auto px-4 max-w-3xl">
           <div className="text-center mb-16 space-y-2">
              <h2 className="text-4xl font-black uppercase italic tracking-tighter text-primary">Dúvidas Frequentes</h2>
              <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest text-secondary">Tudo o que você precisa saber.</p>
           </div>
           <Accordion type="single" collapsible className="w-full space-y-4">
              {FAQS.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-none">
                   <Card className="border-none shadow-sm bg-muted/20 rounded-2xl overflow-hidden">
                      <AccordionTrigger className="px-6 py-5 hover:no-underline font-bold text-sm text-left uppercase italic tracking-tight">
                         {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed font-medium">
                         {faq.a}
                      </AccordionContent>
                   </Card>
                </AccordionItem>
              ))}
           </Accordion>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-24 bg-primary text-white text-center relative overflow-hidden">
         <div className="container mx-auto px-4 relative z-10 space-y-10">
            <div className="max-w-2xl mx-auto space-y-4">
               <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter leading-none">Pronto para divulgar seu próximo evento?</h2>
               <p className="text-lg text-white/60 font-medium leading-relaxed">Junte-se aos organizadores que estão usando a Viby para alcançar mais pessoas.</p>
            </div>
            <Button asChild className="h-20 px-16 bg-secondary text-white font-black rounded-[2rem] shadow-2xl shadow-secondary/30 uppercase italic text-2xl hover:scale-105 transition-all">
               <Link href="/cadastro">Começar Agora</Link>
            </Button>
         </div>
         <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
      </section>

      <Footer />
    </div>
  )
}
