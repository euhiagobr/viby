
"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useFirestore, useAuth, useUser } from "@/firebase"
import { doc, updateDoc, serverTimestamp, increment, getDoc } from "firebase/firestore"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, Ticket, ArrowRight, UserCheck, ShieldCheck, Megaphone } from "lucide-react"
import { getStripeSession } from "@/app/actions/stripe"
import { sendTicketEmail } from "@/app/actions/email"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import Footer from "@/components/layout/Footer"

export default function CheckoutSucessoPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const sessionId = searchParams.get('session_id')
  
  const [loading, setLoading] = React.useState(true)
  const [type, setType] = React.useState<'ticket' | 'plan' | 'ad'>('ticket')
  const [targetId, setTargetId] = React.useState<string | null>(null)

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
        if (!metadata) {
          router.push('/dashboard');
          return;
        }

        if (metadata.type === 'plan_upgrade') {
          setType('plan');
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
          setType('ad');
          setTargetId(metadata.adId);
          const adRef = doc(db, "ads", metadata.adId);
          await updateDoc(adRef, {
            status: "Ativo",
            paymentConfirmedAt: serverTimestamp(),
            stripeSessionId: sessionId,
            updatedAt: serverTimestamp()
          });
          toast({ title: "Campanha Ativa!" });
        }
        else if (metadata.registrationId) {
          setType('ticket');
          const regId = metadata.registrationId;
          setTargetId(regId);
          const regRef = doc(db, "registrations", regId);
          
          await updateDoc(regRef, {
            paymentStatus: "Pago",
            stripeSessionId: sessionId,
            updatedAt: serverTimestamp(),
            confirmedAt: serverTimestamp()
          });

          if (metadata.couponId) {
            await updateDoc(doc(db, "coupons", metadata.couponId), { currentUses: increment(1) });
          }

          const regSnap = await getDoc(regRef);
          if (regSnap.exists()) {
            const regData = regSnap.data();
            const eventDate = regData.eventDate?.toDate ? regData.eventDate.toDate().toLocaleString('pt-BR') : new Date(regData.eventDate).toLocaleString('pt-BR');
            await sendTicketEmail({
              to: regData.userEmail,
              userName: regData.attendeeName || regData.userName,
              eventTitle: regData.eventTitle,
              ticketCode: regData.ticketCode,
              eventDate: eventDate,
              eventCity: regData.eventCity || "Local Confirmado",
              voucherUrl: `https://viby.club/dashboard/ingressos/${regId}/voucher`,
              eventUrl: `https://viby.club/${regData.organizerUsername || 'evento'}/${regData.eventId}`
            });
          }
          toast({ title: "Pagamento Confirmado!" });
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    processSuccess();
  }, [sessionId, db, user, router]);

  if (loading) return <div className="flex flex-col items-center justify-center min-h-screen gap-4"><Loader2 className="w-12 h-12 animate-spin text-secondary" /><p className="text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Confirmando transação...</p></div>

  return (
    <div className="flex flex-col min-h-screen bg-muted/30">
      <div className="flex flex-col items-center justify-center flex-1 p-4">
        <Card className="max-w-md w-full border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
          <div className="flex flex-col items-center gap-4 p-12 text-white bg-green-500">
            <div className="flex items-center justify-center w-20 h-20 bg-white/20 rounded-full backdrop-blur-md"><CheckCircle2 className="w-10 h-10" /></div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter">Tudo Certo!</h1>
            <p className="font-medium text-center text-green-50 opacity-80">Sua reserva foi reconhecida e seu ingresso enviado por e-mail.</p>
          </div>
          <CardContent className="p-10 space-y-8 text-center">
            <div className="flex flex-col gap-3">
              <Button asChild className="h-14 bg-secondary text-white font-black rounded-2xl shadow-xl shadow-secondary/20 uppercase italic">
                <Link href={`/dashboard/ingressos/${targetId}/voucher`}>Ver meu Voucher <ArrowRight className="ml-2 w-5 h-5" /></Link>
              </Button>
            </div>
            <Button variant="ghost" asChild className="font-bold text-muted-foreground"><Link href="/dashboard">Voltar para a Home</Link></Button>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  )
}
