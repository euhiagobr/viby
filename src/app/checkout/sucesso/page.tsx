
"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuth, useUser } from "@/firebase"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react"
import { finalizeCheckoutSession } from "@/app/actions/stripe"
import { toast } from "@/hooks/use-toast"
import { useCart } from "@/contexts/CartContext"
import Link from "next/link"
import Footer from "@/components/layout/Footer"

/**
 * Página de Sucesso de Checkout.
 * Refatorada para delegar a emissão de ingressos ao servidor, garantindo segurança e idempotência.
 */
function CheckoutSucessoContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const auth = useAuth()
  const { user } = useUser(auth)
  const { clearCart } = useCart()
  const sessionId = searchParams.get('session_id')
  
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const isProcessing = React.useRef(false)

  React.useEffect(() => {
    if (!sessionId || !user || isProcessing.current) return;

    const processSuccess = async () => {
      isProcessing.current = true;
      try {
        // INVOCAÇÃO SEGURA: Delega toda a responsabilidade de gravação ao servidor
        const result = await finalizeCheckoutSession(sessionId);
        
        if (result.success) {
          clearCart();
          toast({ title: "Pagamento Confirmado!", description: "Sua reserva foi concluída com total segurança." });
        } else {
          setError(result.error || "Não foi possível confirmar seu pedido.");
        }
      } catch (error: any) {
        console.error("Erro ao processar sucesso de pagamento:", error);
        setError("Ocorreu uma falha na comunicação com o servidor de pagamentos.");
      } finally {
        setLoading(false);
      }
    };

    processSuccess();
  }, [sessionId, user, router, clearCart]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <Loader2 className="w-12 h-12 animate-spin text-secondary" />
      <div className="text-center space-y-1">
         <p className="text-xs font-black uppercase tracking-widest text-primary animate-pulse">Finalizando transação segura...</p>
         <p className="text-[10px] text-muted-foreground font-bold uppercase">Aguarde a validação do banco de dados</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <div className="flex flex-col items-center justify-center flex-1 p-4">
        <Card className="max-w-md w-full border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
          <div className="flex flex-col items-center gap-4 p-12 text-white bg-orange-500">
            <div className="flex items-center justify-center w-20 h-20 bg-white/20 rounded-full backdrop-blur-md">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter">Ops!</h1>
            <p className="font-medium text-center text-orange-50 opacity-80">{error}</p>
          </div>
          <CardContent className="p-10 space-y-6 text-center">
            <p className="text-sm font-medium text-muted-foreground leading-relaxed">
              Tivemos um problema ao confirmar os detalhes do seu pedido. Se você já recebeu a confirmação do banco, seus ingressos podem levar alguns minutos para aparecer.
            </p>
            <Button asChild className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic">
              <Link href="/dashboard/suporte">Abrir Ticket de Suporte</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  )

  return (
    <div className="flex flex-col min-h-screen bg-muted/30">
      <div className="flex flex-col items-center justify-center flex-1 p-4">
        <Card className="max-w-md w-full border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
          <div className="flex flex-col items-center gap-4 p-12 text-white bg-green-500">
            <div className="flex items-center justify-center w-20 h-20 bg-white/20 rounded-full backdrop-blur-md">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter">Tudo Certo!</h1>
            <p className="font-medium text-center text-green-50 opacity-80">Sua transação foi validada e processada no servidor.</p>
          </div>
          <CardContent className="p-10 space-y-8 text-center">
            <div className="space-y-4">
               <div className="flex items-center justify-center gap-2 text-green-600">
                  <ShieldCheck className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Emissão Segura Concluída</span>
               </div>
               <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                 Seus ingressos nominais foram gerados e já estão disponíveis na sua carteira digital.
               </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button asChild className="h-16 bg-secondary text-white font-black rounded-2xl shadow-xl shadow-secondary/20 uppercase italic text-lg hover:scale-[1.02] transition-transform">
                <Link href="/dashboard/ingressos">Ver Meus Ingressos <ArrowRight className="ml-2 w-5 h-5" /></Link>
              </Button>
              <Button variant="ghost" asChild className="font-bold text-xs uppercase text-muted-foreground">
                <Link href="/dashboard">Voltar para o Início</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  )
}

export default function CheckoutSucessoPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>}>
      <CheckoutSucessoContent />
    </React.Suspense>
  );
}
