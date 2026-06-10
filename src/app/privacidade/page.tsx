import * as React from "react"
import { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, ShieldCheck, Mail, MapPin, User, Lock, Eye } from "lucide-react"
import Footer from "@/components/layout/Footer"

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description: 'Saiba como a Viby protege seus dados e garante a segurança da sua identidade digital e transações.',
  alternates: { canonical: '/privacidade' }
}

export default function PoliticaPrivacidadePage() {
  const siteName = "Viby"

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <span className="text-xl font-bold tracking-tight">{siteName}</span>
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
              <ShieldCheck className="w-3 h-3" />
              Privacidade e Dados
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic text-primary">
              Política de <span className="text-secondary">Privacidade</span>
            </h1>
            <p className="text-muted-foreground font-medium">
              Última atualização: 19 de maio de 2026
            </p>
          </div>

          <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
            <CardContent className="p-8 md:p-12 prose prose-slate max-w-none">
              <div className="space-y-8 text-foreground/80 leading-relaxed font-medium text-sm md:text-base">
                <p>
                  A presente Política de Privacidade descreve como a {siteName} coleta, utiliza, armazena e protege os dados dos usuários que acessam a plataforma.
                </p>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">1.</span> Dados Coletados
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-muted/30 p-6 rounded-2xl space-y-2 border-l-4 border-secondary">
                      <p className="font-black text-xs uppercase tracking-widest text-primary mb-2 flex items-center gap-2">
                        <User className="w-3.5 h-3.5" /> Cadastro
                      </p>
                      <p className="text-xs">Nome, e-mail, telefone, foto de perfil, data de nascimento, CPF, CNPJ e endereço.</p>
                    </div>
                    <div className="bg-muted/30 p-6 rounded-2xl space-y-2 border-l-4 border-secondary">
                      <p className="font-black text-xs uppercase tracking-widest text-primary mb-2 flex items-center gap-2">
                        <Eye className="w-3.5 h-3.5" /> Utilização
                      </p>
                      <p className="text-xs">Eventos visualizados, interações, histórico de compras, acessos, dispositivo e localização.</p>
                    </div>
                  </div>
                  <div className="bg-primary/5 p-6 rounded-2xl border-2 border-dashed border-primary/10 flex items-start gap-4">
                    <Lock className="w-5 h-5 text-primary shrink-0 mt-1" />
                    <div>
                      <p className="font-bold text-sm text-primary uppercase tracking-tighter">Segurança Financeira</p>
                      <p className="text-xs text-muted-foreground mt-1">Pagamentos processados pela Stripe. A {siteName} não armazena dados sensíveis de cartões.</p>
                    </div>
                  </div>
                </section>

                <section className="space-y-6">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">2.</span> Contato e Dúvidas
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-4 bg-muted/20 rounded-xl">
                      <MapPin className="w-5 h-5 text-secondary" />
                      <div>
                        <p className="text-[10px] font-black uppercase opacity-60">Localidade</p>
                        <p className="font-bold">Porto Alegre / RS</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-muted/20 rounded-xl">
                      <Mail className="w-5 h-5 text-secondary" />
                      <div>
                        <p className="text-[10px] font-black uppercase opacity-60">Suporte</p>
                        <p className="font-bold">privacidade@viby.club</p>
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
