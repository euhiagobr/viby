
"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useFirestore, useAuth, useUser } from "@/firebase"
import { doc, updateDoc, serverTimestamp, getDoc, increment } from "firebase/firestore"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, ArrowRight } from "lucide-react"
import { getStripeSession } from "@/app/actions/stripe"
import { sendTicketEmail } from "@/app/actions/email"
import { toast } from "@/hooks/use-toast"
import { useCart } from "@/contexts/CartContext"
import Link from "next/link"
import Footer from "@/components/layout/Footer"

export default function CheckoutSucessoPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const { clearCart } = useCart()
  const sessionId = searchParams.get('session_id')
  
  const [loading, setLoading] = React.useState(true)
  const isProcessing = React.useRef(false)

  React.useEffect(() => {
    if (!sessionId || !db || !user || isProcessing.current) return;

    const processSuccess = async () => {
      isProcessing.current = true;
      try {
        const session = await getStripeSession(sessionId);
        if (!session || session.payment_status !== 'paid') {
          router.push('/dashboard');
          return;
        }

        const metadata = session.metadata;
        if (!metadata) {
          router.push('/dashboard');
          return;
        }

        if (metadata.type === 'plan_upgrade') {
          const userRef = doc(db, "users", metadata.userId);
          const amountPaid = (session.amount_total || 0) / 100;
          await updateDoc(userRef, {
            plan: metadata.plan,
            billingCycle: metadata.cycle,
            isVerified: true, 
            updatedAt: serverTimestamp(),
            lastPlanPaymentAt: serverTimestamp(),
            lastPlanAmount: amountPaid
          });
          toast({ title: "Upgrade Realizado!" });
        } 
        else if (metadata.type === 'ad_payment') {
          const adRef = doc(db, "ads", metadata.adId);
          await updateDoc(adRef, {
            status: "Ativo",
            paymentConfirmedAt: serverTimestamp(),
            stripeSessionId: sessionId,
            updatedAt: serverTimestamp()
          });
          toast({ title: "Campanha Ativa!" });
        }
        else if (metadata.type === 'ad_balance_topup') {
          const orgRef = doc(db, "organizations", metadata.orgId);
          const amountToCredit = parseFloat(metadata.baseAmount);
          await updateDoc(orgRef, {
            adBalance: increment(amountToCredit),
            updatedAt: serverTimestamp()
          });
          toast({ title: "Saldo Recarregado!", description: `R$ ${amountToCredit.toFixed(2)} adicionados para anúncios.` });
        }
        else if (metadata.type === 'cart_checkout' || metadata.registrationId) {
          const regIds = metadata.type === 'cart_checkout' 
            ? metadata.registrationIds.split(",") 
            : [metadata.registrationId];
          
          for (const regId of regIds) {
            const regRef = doc(db, "registrations", regId);
            const regSnap = await getDoc(regRef);
            
            if (regSnap.exists()) {
              const regData = regSnap.data();
              if (regData.paymentStatus !== "Pago") {
                await updateDoc(regRef, {
                  paymentStatus: "Pago",
                  stripeSessionId: sessionId,
                  updatedAt: serverTimestamp(),
                  confirmedAt: serverTimestamp()
                });

                const eventDate = regData.eventDate?.toDate ? regData.eventDate.toDate().toLocaleString('pt-BR') : new Date(regData.eventDate).toLocaleString('pt-BR');
                
                await sendTicketEmail({
                  to: regData.userEmail,
                  userName: regData.attendeeName || regData.userName,
                  eventTitle: regData.eventTitle,
                  ticketCode: regData.ticketCode,
                  eventDate: eventDate,
                  eventCity: regData.eventCity || "Local Confirmado",
                  voucherUrl: `https://viby.club/dashboard/ingressos/${regId}/voucher`,
                  eventUrl: `https://viby.club/${regData.organizerUsername || 'evento'}/${regData.eventId}`,
                  ticketPrice: regData.ticketBasePrice || 0,
                  feePrice: regData.administrativeFeeAmount || 0,
                  totalPrice: regData.price || 0,
                  isFree: (regData.ticketBasePrice || 0) === 0
                });
              }
            }
          }

          if (metadata.type === 'cart_checkout') clearCart();
          toast({ title: "Pagamento Confirmado!" });
        }
      } catch (error) {
        console.error("Erro ao processar sucesso de pagamento:", error);
      } finally {
        setLoading(false);
      }
    };

    processSuccess();
  }, [sessionId, db, user, router, clearCart]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <Loader2 className="w-12 h-12 animate-spin text-secondary" />
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Confirmando transação...</p>
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
            <p className="font-medium text-center text-green-50 opacity-80">Sua transação foi concluída com sucesso.</p>
          </div>
          <CardContent className="p-10 space-y-8 text-center">
            <div className="flex flex-col gap-3">
              <Button asChild className="h-14 bg-secondary text-white font-black rounded-2xl shadow-xl shadow-secondary/20 uppercase italic">
                <Link href="/dashboard">Voltar para o Painel <ArrowRight className="ml-2 w-5 h-5" /></Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  )
}
