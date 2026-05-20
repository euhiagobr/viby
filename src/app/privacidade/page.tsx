"use client"

import * as React from "react"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, ShieldCheck, Globe, Mail, MapPin, User, Lock, Eye, Database, Globe2 } from "lucide-react"
import Link from "next/link"
import { Footer } from "@/components/layout/Footer"

export default function PoliticaPrivacidadePage() {
  const db = useFirestore()
  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)
  
  const siteName = settings?.siteName || "Viby"

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Menu Superior Simples */}
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {settings?.logoUrl ? (
              <div className="w-8 h-8 relative flex items-center justify-center">
                <img src={settings.logoUrl} alt={siteName} className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">{siteName.charAt(0)}</span>
              </div>
            )}
            <span className="text-xl font-bold tracking-tight">{siteName}</span>
          </Link>
          <Button variant="ghost" asChild className="font-semibold">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao Início
            </Link>
          </Button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12 md:py-20 flex-1">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="space-y-4 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck className="w-3 h-3" />
              Segurança e Privacidade
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
                  A presente Política de Privacidade descreve como a <strong>{siteName}</strong> coleta, utiliza, armazena e protege os dados dos usuários que acessam a plataforma, seus aplicativos e serviços relacionados. Ao utilizar a plataforma, você concorda com os termos desta Política.
                </p>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">1.</span> Dados Coletados
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-muted/30 p-6 rounded-2xl space-y-2 border-l-4 border-secondary">
                      <p className="font-black text-xs uppercase tracking-widest text-primary mb-2 flex items-center gap-2">
                        <User className="w-3.5 h-3.5" /> Dados de cadastro
                      </p>
                      <p className="text-xs">Nome, e-mail, telefone, foto de perfil, data de nascimento, CPF, CNPJ, endereço e informações comerciais.</p>
                    </div>
                    <div className="bg-muted/30 p-6 rounded-2xl space-y-2 border-l-4 border-secondary">
                      <p className="font-black text-xs uppercase tracking-widest text-primary mb-2 flex items-center gap-2">
                        <Eye className="w-3.5 h-3.5" /> Dados de utilização
                      </p>
                      <p className="text-xs">Eventos visualizados, interações, histórico de compras, acessos, dispositivo, IP, localização aproximada e preferências.</p>
                    </div>
                  </div>
                  <div className="bg-primary/5 p-6 rounded-2xl border-2 border-dashed border-primary/10 flex items-start gap-4">
                    <Lock className="w-5 h-5 text-primary shrink-0 mt-1" />
                    <div>
                      <p className="font-bold text-sm text-primary uppercase tracking-tighter">Dados financeiros</p>
                      <p className="text-xs text-muted-foreground mt-1">Os pagamentos são processados por parceiros externos (Stripe). A {siteName} não armazena dados completos de cartões bancários.</p>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">2.</span> Como os Dados São Utilizados
                  </h2>
                  <p>Os dados poderão ser utilizados para: funcionamento da plataforma, autenticação, processamento de pagamentos, prevenção a fraudes, análise de comportamento, personalização de conteúdo, recomendações de eventos, comunicação direta e cumprimento de obrigações legais.</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">3.</span> Perfis Públicos
                  </h2>
                  <p>A plataforma disponibiliza perfis públicos contendo: nome, foto de perfil e informações públicas cadastradas. As relações de seguidores entre usuários e empresas não são exibidas publicamente para terceiros.</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">4.</span> Compartilhamento de Dados
                  </h2>
                  <p>A {siteName} poderá compartilhar informações com processadores de pagamento, serviços antifraude, fornecedores tecnológicos e autoridades judiciais. <strong>A plataforma não comercializa dados pessoais dos usuários.</strong></p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">5.</span> Cookies e Rastreamento
                  </h2>
                  <p>Utilizamos cookies, pixels e ferramentas analíticas para auxiliar na segurança, desempenho e personalização da experiência do usuário.</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">6.</span> Armazenamento e Segurança
                  </h2>
                  <p>Adotamos medidas técnicas e organizacionais para proteção das informações. Apesar dos esforços, nenhum sistema é completamente imune a falhas ou ataques cibernéticos.</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">7.</span> Direitos do Usuário
                  </h2>
                  <p>O usuário poderá solicitar: acesso, atualização, correção ou exclusão de seus dados, bem como a revogação de consentimentos, respeitando obrigações legais e prevenções a fraude.</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">8.</span> Retenção de Dados
                  </h2>
                  <p>Os dados são mantidos enquanto a conta estiver ativa, houver necessidade operacional ou existirem obrigações legais e auditorias pendentes.</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">9.</span> Menores de Idade
                  </h2>
                  <p>A plataforma não possui idade mínima obrigatória. Usuários menores de idade devem utilizar os serviços sob responsabilidade de seus responsáveis legais.</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">10.</span> Transferência Internacional
                  </h2>
                  <p>Alguns serviços utilizados podem armazenar ou processar informações em servidores fora do Brasil. Ao utilizar a plataforma, o usuário concorda com essa possibilidade.</p>
                </section>

                <section className="space-y-6">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">11.</span> Contato
                  </h2>
                  <p>Para dúvidas ou solicitações relacionadas à privacidade:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-4 bg-muted/20 rounded-xl">
                      <User className="w-5 h-5 text-secondary" />
                      <div>
                        <p className="text-[10px] font-black uppercase opacity-60">Responsável</p>
                        <p className="font-bold">Hiago Alves</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-muted/20 rounded-xl">
                      <MapPin className="w-5 h-5 text-secondary" />
                      <div>
                        <p className="text-[10px] font-black uppercase opacity-60">Localidade</p>
                        <p className="font-bold">Porto Alegre / RS</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-muted/20 rounded-xl md:col-span-2">
                      <Mail className="w-5 h-5 text-secondary" />
                      <div>
                        <p className="text-[10px] font-black uppercase opacity-60">E-mail para suporte</p>
                        <p className="font-bold">privacidade@viby.club</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">12.</span> Legislação Aplicável
                  </h2>
                  <p>Esta Política é regida pelas leis da República Federativa do Brasil, incluindo a <strong>Lei Geral de Proteção de Dados Pessoais (LGPD)</strong>.</p>
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
