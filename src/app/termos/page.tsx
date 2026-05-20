"use client"

import * as React from "react"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, FileText, Globe, Mail, MapPin, User } from "lucide-react"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import Footer from "@/components/layout/Footer"

export default function TermosDeUsoPage() {
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
              <FileText className="w-3 h-3" />
              Documentação Legal
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
                  Bem-vindo à <strong>{siteName}</strong>. Ao acessar ou utilizar a plataforma, você concorda com os presentes Termos de Uso. Caso não concorde com qualquer condição aqui descrita, recomendamos que não utilize os serviços disponibilizados.
                </p>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">1.</span> Sobre a Plataforma
                  </h2>
                  <p>
                    A {siteName} é uma plataforma digital de divulgação, gerenciamento e comercialização de eventos, disponível via website e aplicativos para dispositivos móveis.
                  </p>
                  <p>
                    A plataforma permite que usuários descubram eventos, sigam empresas e perfis públicos, adquiram ingressos e interajam com conteúdos relacionados aos eventos cadastrados.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">2.</span> Cadastro e Uso da Plataforma
                  </h2>
                  <p>O uso da plataforma é permitido para qualquer pessoa, sem idade mínima obrigatória.</p>
                  <p>Para utilizar determinadas funcionalidades, poderá ser necessário realizar cadastro com informações verdadeiras, completas e atualizadas.</p>
                  <div className="bg-muted/30 p-6 rounded-2xl border-l-4 border-secondary space-y-2">
                    <p className="font-black text-xs uppercase tracking-widest text-primary mb-2">O usuário é responsável por:</p>
                    <ul className="list-disc ml-4 space-y-1">
                      <li>Manter a segurança de sua conta;</li>
                      <li>Não compartilhar credenciais de acesso;</li>
                      <li>Garantir a veracidade das informações fornecidas.</li>
                    </ul>
                  </div>
                  <p>A {siteName} poderá suspender ou remover contas que apresentem informações falsas, suspeitas ou que violem estes Termos.</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">3.</span> Perfis e Privacidade
                  </h2>
                  <p>A plataforma disponibiliza perfis públicos contendo informações como: nome, foto de perfil e informações públicas cadastradas.</p>
                  <p>A plataforma permite seguir pessoas e empresas. Essas informações de relacionamento não são exibidas publicamente para outros usuários.</p>
                  <p>A utilização dos dados pessoais ocorre conforme a legislação aplicável e políticas internas da plataforma.</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">4.</span> Criação de Eventos
                  </h2>
                  <p>Somente empresas com CNPJ cadastrado e aprovado poderão criar eventos na plataforma.</p>
                  <p>A {siteName} poderá realizar processos de validação e verificação das empresas cadastradas antes da liberação das funcionalidades de publicação.</p>
                  <div className="bg-muted/30 p-6 rounded-2xl border-l-4 border-secondary space-y-2">
                    <p className="font-black text-xs uppercase tracking-widest text-primary mb-2">Os organizadores são integralmente responsáveis:</p>
                    <ul className="list-disc ml-4 space-y-1">
                      <li>Pelas informações dos eventos;</li>
                      <li>Pela legalidade do evento;</li>
                      <li>Pela realização do evento;</li>
                      <li>Pelas autorizações necessárias;</li>
                      <li>Pela venda e execução dos ingressos.</li>
                    </ul>
                  </div>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">5.</span> Ingressos, Pagamentos e Reembolsos
                  </h2>
                  <p>A plataforma poderá comercializar ingressos digitais diretamente aos usuários.</p>
                  <p>Os pagamentos são processados por meio da plataforma Stripe e seus respectivos parceiros financeiros.</p>
                  <p>Os usuários poderão solicitar cancelamento e reembolso de ingressos em até 30 dias após a compra.</p>
                  <p>A solicitação será analisada pela plataforma e, caso considerada legítima, o ingresso poderá ser cancelado e o reembolso realizado conforme critérios internos e regras aplicáveis.</p>
                  <p>A {siteName} poderá bloquear reembolsos em casos de: suspeita de fraude, uso indevido, má-fé, utilização parcial do benefício adquirido ou chargeback indevido.</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">6.</span> Saldo, Saques e Recebimentos
                  </h2>
                  <p>A plataforma poderá disponibilizar funcionalidades de saldo financeiro e solicitação de saque para produtores e empresas cadastradas.</p>
                  <p>Os pagamentos e transferências poderão depender de aprovação cadastral, validação documental, análise antifraude e regras dos processadores financeiros utilizados.</p>
                  <p>A {siteName} poderá reter temporariamente valores em casos de investigação, contestação financeira, suspeita de fraude ou violação destes Termos.</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">7.</span> Conteúdo Proibido
                  </h2>
                  <p>É proibida a utilização da plataforma para: discurso de dódio, discriminação, ameaças, assédio, conteúdos ilegais, divulgação enganosa, criação de eventos falsos, utilização de perfis falsos, spam, tentativa de fraude, violação de direitos autorais ou atividades ilícitas.</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">8.</span> Suspensão e Remoção de Contas
                  </h2>
                  <p>A {siteName} poderá, a qualquer momento e sem aviso prévio: remover conteúdos, cancelar eventos, suspender contas, bloquear funcionalidades, excluir perfis ou registrar acessos.</p>
                  <p>Isso poderá ocorrer em casos de violação destes Termos, denúncias recorrentes, atividades suspeitas, fraudes, eventos falsos, ofensas ou discurso de ódio, e descumprimento da legislação aplicável.</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">9.</span> Responsabilidade sobre Eventos
                  </h2>
                  <p>A {siteName} atua como plataforma intermediadora tecnológica. A responsabilidade pela realização dos eventos é exclusivamente dos organizadores responsáveis por cada publicação.</p>
                  <p>A plataforma não garante a realização do evento, qualidade do serviço prestado, segurança do local ou veracidade absoluta das informações fornecidas pelos organizadores.</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">10.</span> Propriedade Intelectual
                  </h2>
                  <p>Todo o conteúdo, identidade visual, marcas, logotipos, layout, funcionalidades e tecnologias da {siteName} são protegidos pela legislação aplicável de propriedade intelectual.</p>
                  <p>É proibida a reprodução, cópia, modificação ou utilização sem autorização prévia.</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">11.</span> Compartilhamento de Dados
                  </h2>
                  <p>A {siteName} poderá compartilhar dados estritamente necessários com processadores de pagamento, serviços antifraude, parceiros tecnológicos e autoridades legais quando exigido por lei.</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">12.</span> Disponibilidade da Plataforma
                  </h2>
                  <p>A {siteName} poderá alterar, interromper ou remover funcionalidades da plataforma a qualquer momento, sem obrigação de aviso prévio. Não garantimos funcionamento ininterrupto ou livre de falhas.</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">13.</span> Limitação de Responsabilidade
                  </h2>
                  <p>A {siteName} não será responsável por prejuízos indiretos, perdas financeiras decorrentes de eventos, cancelamentos realizados por organizadores, condutas de terceiros, problemas causados por serviços externos ou indisponibilidades temporárias da plataforma.</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">14.</span> Alterações destes Termos
                  </h2>
                  <p>Os presentes Termos poderão ser atualizados a qualquer momento. O uso contínuo da plataforma após alterações representa concordância com as novas condições.</p>
                </section>

                <section className="space-y-6">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">15.</span> Contato
                  </h2>
                  <p>Em caso de dúvidas, solicitações ou denúncias, entre em contato:</p>
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
                        <p className="font-bold">suporte@viby.club</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">16.</span> Foro
                  </h2>
                  <p>Fica eleito o foro da comarca de Porto Alegre/RS para resolução de quaisquer disputas relacionadas à utilização da plataforma, com renúncia a qualquer outro, por mais privilegiado que seja.</p>
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
