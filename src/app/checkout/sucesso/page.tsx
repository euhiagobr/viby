
"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useFirestore, useAuth, useUser } from "@/firebase"
import { doc, updateDoc, serverTimestamp, increment } from "firebase/firestore"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, Ticket, ArrowRight } from "lucide-react"
import { getStripeSession } from "@/app/actions/stripe"
import { toast } from "@/hooks/use-toast"

export default function CheckoutSucessoPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const sessionId = searchParams.get('session_id')
  
  const [loading, setLoading] = React.useState(true)
  const [registrationId, setRegistrationId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!sessionId || !db || !user) return;

    const processSuccess = async () => {
      try {
        const session = await getStripeSession(sessionId);
        if (!session || session.payment_status !== 'paid') {
          router.push('/dashboard');
          return;
        }

        const metadata = session.metadata;
        if (!metadata || !metadata.registrationId) {
          toast({ variant: "destructive", title: "Erro na transação", description: "Metadados do ingresso não encontrados." });
          router.push('/dashboard');
          return;
        }

        const regId = metadata.registrationId;
        setRegistrationId(regId);

        // Atualizar o doc PENDENTE para PAGO
        const regRef = doc(db, "registrations", regId);
        
        await updateDoc(regRef, {
          paymentStatus: "Pago",
          stripeSessionId: sessionId,
          updatedAt: serverTimestamp(),
          confirmedAt: serverTimestamp()
        });

        // Incrementar uso do cupom se existir
        if (metadata.couponId) {
          await updateDoc(doc(db, "coupons", metadata.couponId), {
            currentUses: increment(1)
          });
        }

        toast({ title: "Pagamento Confirmado!", description: "Seu ingresso foi liberado com sucesso." });
      } catch (error) {
        console.error("Erro ao processar sucesso:", error);
        toast({ variant: "destructive", title: "Erro ao sincronizar", description: "Seu pagamento foi feito, mas houve um erro ao atualizar o ingresso. Contate o suporte." });
      } finally {
        setLoading(false);
      }
    };

    processSuccess();
  }, [sessionId, db, user, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-secondary" />
        <p className="font-bold text-muted-foreground animate-pulse uppercase tracking-widest text-xs">Confirmando seu pagamento no Stripe...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="max-w-md w-full border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
        <div className="bg-green-500 p-12 flex flex-col items-center text-white gap-4">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">Tudo Certo!</h1>
          <p className="text-green-50 font-medium text-center opacity-80">Sua reserva foi reconhecida e o pagamento processado com sucesso.</p>
        </div>
        <CardContent className="p-10 space-y-8 text-center">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Seu QR Code de acesso já está disponível em</p>
            <div className="flex items-center justify-center gap-2 text-xl font-bold text-primary">
              <Ticket className="w-6 h-6 text-secondary" />
              Meus Ingressos
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button asChild className="h-14 bg-secondary text-white font-black rounded-2xl shadow-xl shadow-secondary/20 uppercase italic">
              <Link href={`/dashboard/ingressos/${registrationId}/voucher`}>
                Ver meu Voucher
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button variant="ghost" asChild className="font-bold text-muted-foreground hover:bg-muted/50">
              <Link href="/dashboard">Voltar para Explorar</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
