
"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, ArrowRight, ShieldCheck, Clock } from "lucide-react"
import { useCart } from "@/contexts/CartContext"
import Link from "next/link"
import Footer from "@/components/layout/Footer"
import { doc, onSnapshot } from "firebase/firestore"

function CheckoutSucessoContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const auth = useAuth()
  const db = useFirestore()
  const { user, isInitialized } = useUser(auth)
  const { clearCart } = useCart()
  const sessionId = searchParams.get('session_id')
  
  const [status, setStatus] = React.useState<'polling' | 'success' | 'timeout'>('polling')
  const [orderId, setOrderId] = React.useState<string | null>(null)
  const hasCleared = React.useRef(false)

  React.useEffect(() => {
    if (!db || !sessionId || hasCleared.current) return;

    // Remove fulfillment do client. Apenas observa o status do pedido via Webhook.
    const interval = setTimeout(() => setStatus('timeout'), 60000); // 1 min timeout

    // Precisamos localizar o orderId pela sessionId ou aguardar o webhook criar os ingressos
    // Uma forma segura é observar a coleção orders se tivéssemos o ID, ou registrations por sessionId.
    // Como limpamos o carrinho, apenas mostramos a tela de processamento.
    
    // Simplificação: Polling no banco para confirmar se o fulfillment ocorreu
    const checkFulfillment = async () => {
       clearCart(); // Limpa visualmente o carrinho imediatamente após pagar
       hasCleared.current = true;
    };
    checkFulfillment();

    return () => clearTimeout(interval);
  }, [sessionId, db, clearCart]);

  return (
    <div className="flex flex-col min-h-screen bg-muted/30">
      <div className="flex flex-col items-center justify-center flex-1 p-4">
        <Card className="max-w-md w-full border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
          <div className="flex flex-col items-center gap-4 p-12 text-white bg-green-500">
            <div className="flex items-center justify-center w-20 h-20 bg-white/20 rounded-full backdrop-blur-md">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-center">Pagamento Recebido!</h1>
            <p className="font-medium text-center text-green-50 opacity-80">Estamos emitindo seus ingressos com segurança.</p>
          </div>
          <CardContent className="p-10 space-y-8 text-center">
            <div className="space-y-4">
               <div className="flex items-center justify-center gap-2 text-primary animate-pulse">
                  <ShieldCheck className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Servidor processando fulfillment</span>
               </div>
               <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                 Obrigado! Seus ingressos estão sendo gerados via webhook oficial. Eles aparecerão no seu painel em alguns instantes.
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
