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
            <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">Última atualização: 11 de julho de 2026</p>
         </div>

         <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
            <CardContent className="p-8 md:p-12 prose prose-slate max-w-none text-sm md:text-base leading-relaxed font-medium">
               <p>A <strong>{siteName}</strong> ("nós", "nosso", "plataforma") está comprometida em proteger a sua privacidade. Esta Política de Privacidade explica de forma clara e transparente como coletamos, usamos, compartilhamos e protegemos os dados pessoais dos nossos usuários ("você", "Comprador", "Organizador"), em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018).</p>
               
               <p>Ao acessar o site <a href="https://viby.club/" target="_blank" rel="noopener noreferrer">viby.club</a>, criar uma conta, comprar um ingresso ou publicar um evento, você concorda com as práticas descritas neste documento.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">1. Quais dados nós coletamos?</h3>
               <p>Para que o lema <em>"Descubra. Viva. Compartilhe. Viby."</em> funcione na prática, precisamos de algumas informações para garantir a sua segurança e a emissão correta dos seus ingressos. Coletamos os seguintes dados:</p>
               <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Dados de Cadastro (Compradores):</strong> Nome completo, e-mail, CPF, data de nascimento, número de telefone celular e senha criptografada.</li>
                  <li><strong>Dados de Cadastro (Organizadores):</strong> Além dos dados acima, podemos coletar CNPJ, razão social, endereço comercial e dados de representantes legais para a criação da conta na plataforma.</li>
                  <li><strong>Dados Financeiros e de Pagamento:</strong> Para processar suas compras, coletamos dados de faturamento. <strong>Importante:</strong> A {siteName} não armazena os dados do seu cartão de crédito. Essas informações são coletadas e processadas de forma segura e direta pelo nosso gateway de pagamento parceiro (Stripe).</li>
                  <li><strong>Dados de Navegação e Dispositivo:</strong> Endereço IP, tipo de navegador, sistema operacional, páginas visitadas dentro da {siteName}, horários de acesso e dados de geolocalização (quando autorizados no seu dispositivo) para recomendar eventos próximos a você.</li>
               </ul>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">2. Como utilizamos os seus dados?</h3>
               <p>A {siteName} utiliza as suas informações para as seguintes finalidades:</p>
               <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Prestação do Serviço:</strong> Criar sua conta, processar o pagamento do seu pedido, gerar e enviar os seus ingressos digitais (QR Code).</li>
                  <li><strong>Comunicação:</strong> Enviar e-mails transacionais (confirmação de compra, alteração de horário de evento, reembolsos) e avisos de segurança.</li>
                  <li><strong>Operações do Organizador:</strong> Fornecer aos organizadores de eventos as ferramentas necessárias para controle de portaria, validação de ingressos e gestão de público.</li>
                  <li><strong>Segurança e Prevenção à Fraude:</strong> Monitorar atividades suspeitas e proteger a plataforma contra acessos não autorizados e fraudes financeiras.</li>
                  <li><strong>Marketing (Opcional):</strong> Enviar recomendações de eventos, novidades da {siteName} e promoções, desde que você tenha consentido com esse recebimento (podendo cancelar a qualquer momento).</li>
               </ul>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">3. Com quem compartilhamos os seus dados?</h3>
               <p>A {siteName} não vende ou aluga seus dados pessoais. Compartilhamos suas informações apenas quando estritamente necessário para a operação da plataforma:</p>
               <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Com os Organizadores de Eventos:</strong> Quando você compra um ingresso, o organizador do respectivo evento tem acesso ao seu nome, e-mail e informações do ingresso (tipo e número do pedido) para fins de gestão de lista de convidados, controle de portaria e comunicação sobre o evento específico. Os organizadores são proibidos de usar esses dados para outras finalidades sem o seu consentimento.</li>
                  <li><strong>Com Provedores de Pagamento:</strong> Compartilhamos os dados estritamente necessários com o nosso provedor de pagamentos financeiro (Stripe) exclusivamente para o processamento das transações, prevenção a fraudes, validação de segurança e emissão de reembolsos.</li>
                  <li><strong>Com Fornecedores de Tecnologia:</strong> Serviços de hospedagem em nuvem (ex: Firebase/Google Cloud), servidores de envio de e-mail e ferramentas de análise de dados, que atuam sob nossas diretrizes de segurança e confidencialidade.</li>
                  <li><strong>Por Determinação Legal:</strong> Podemos compartilhar dados com autoridades públicas, policiais ou judiciais, caso sejamos obrigados por lei ou ordem judicial.</li>
               </ul>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">4. Armazenamento e Segurança</h3>
               <p>Seus dados são armazenados em servidores seguros, com camadas de criptografia padrão da indústria e controles de acesso restrito. Manteremos os seus dados pessoais apenas pelo tempo necessário para cumprir com as finalidades para as quais foram coletados, inclusive para fins de cumprimento de obrigações legais, contratuais, de prestação de contas ou requisição de autoridades competentes.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">5. Seus Direitos (LGPD)</h3>
               <p>Você tem total controle sobre os seus dados. A qualquer momento, você pode solicitar:</p>
               <ul className="list-disc pl-6 space-y-2">
                  <li>A confirmação da existência de tratamento de dados e o acesso a eles.</li>
                  <li>A correção de dados incompletos, inexatos ou desatualizados diretamente pelo painel da sua conta.</li>
                  <li>A exclusão da sua conta e dos seus dados pessoais (exceto aqueles que somos obrigados a manter por exigência fiscal ou legal relacionada a compras já efetuadas).</li>
                  <li>A revogação do consentimento para envio de e-mails promocionais.</li>
               </ul>
               <p>Para exercer seus direitos de exclusão ou solicitar informações, entre em contato pelo e-mail especificado no final desta política.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">6. Uso de Cookies e Tecnologias Semelhantes</h3>
               <p>Utilizamos cookies e tecnologias de rastreamento para melhorar a sua experiência na {siteName}, manter a sua sessão de login ativa, entender como você interage com a plataforma e garantir o funcionamento correto do carrinho de compras. Você pode gerenciar ou desabilitar os cookies nas configurações do seu navegador, mas isso pode afetar o funcionamento de algumas áreas do nosso site.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">7. Atualizações desta Política</h3>
               <p>A {siteName} está em constante evolução. Por isso, podemos atualizar esta Política de Privacidade periodicamente para refletir mudanças nos nossos serviços ou nas leis aplicáveis. Recomendamos que você revise esta página regularmente. Em caso de mudanças significativas, notificaremos os usuários ativos por e-mail ou via aviso destacado na plataforma.</p>

               <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary mt-10">8. Como entrar em contato</h3>
               <p>Se você tiver dúvidas sobre esta Política de Privacidade, sobre como seus dados são tratados, ou se desejar exercer os seus direitos garantidos pela LGPD, entre em contato conosco através do canal oficial:</p>
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
