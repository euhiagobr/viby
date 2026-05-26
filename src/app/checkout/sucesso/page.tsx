
"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useFirestore, useAuth, useUser } from "@/firebase"
import { doc, updateDoc, serverTimestamp, getDoc, increment, addDoc, collection, setDoc } from "firebase/firestore"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, ArrowRight } from "lucide-react"
import { getStripeSession } from "@/app/actions/stripe"
import { sendTicketEmail } from "@/app/actions/email"
import { toast } from "@/hooks/use-toast"
import { useCart } from "@/contexts/CartContext"
import Link from "next/link"
import Footer from "@/components/layout/Footer"
import { calculateDetailedVibyBreakdown } from "@/lib/financial-utils"
import { processGamificationEvent } from "@/lib/gamification-service"

function CheckoutSucessoContent() {
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

        const userSnap = await getDoc(doc(db, "users", user.uid));
        const userData = userSnap.exists() ? userSnap.data() : null;

        // Se houver saldo usado em uma recarga de anúncio
        if (metadata.type === 'ad_balance_topup') {
          const orgRef = doc(db, "organizations", metadata.orgId);
          const amountToCredit = parseFloat(metadata.baseAmount);
          
          await updateDoc(orgRef, {
            adBalance: increment(amountToCredit),
            updatedAt: serverTimestamp()
          });

          if (metadata.transactionId) {
            const txRef = doc(db, 'organizations', metadata.orgId, 'transactions', metadata.transactionId);
            await updateDoc(txRef, {
              status: 'completed',
              updatedAt: serverTimestamp(),
              stripeSessionId: sessionId
            });
          }

          toast({ title: "Saldo Recarregado!", description: `R$ ${amountToCredit.toFixed(2)} adicionados para anúncios.` });
        }
        // Se for checkout de carrinho (Ingressos)
        else if (metadata.type === 'cart_checkout' || metadata.registrationId) {
          const regIds = metadata.type === 'cart_checkout' 
            ? metadata.registrationIds.split(",") 
            : [metadata.registrationId];
          
          // Verificar se houve abatimento de saldo da carteira (parcial)
          const balanceUsed = parseFloat(metadata.balanceUsed || "0");
          if (balanceUsed > 0) {
            const userRef = doc(db, "users", user.uid);
            const walletRef = doc(db, "wallets", user.uid);

            // Sincroniza ambos os documentos de saldo para garantir consistência no Ledger
            await updateDoc(userRef, {
              walletBalance: increment(-balanceUsed),
              updatedAt: serverTimestamp()
            });

            await setDoc(walletRef, {
              balance: increment(-balanceUsed),
              updatedAt: serverTimestamp()
            }, { merge: true });

            // Registrar transação de carteira no histórico
            await addDoc(collection(db, "wallet_transactions"), {
              userId: user.uid,
              amount: balanceUsed,
              type: 'debit',
              reason: 'compra_ingresso',
              description: `Abatimento Checkout: ${regIds.length > 1 ? 'Múltiplos itens' : 'Ingresso'}`,
              timestamp: serverTimestamp()
            });
          }

          const [stripeSettingsSnap, feesSettingsSnap, promosSnap] = await Promise.all([
            getDoc(doc(db, 'settings', 'stripe')),
            getDoc(doc(db, 'settings', 'fees')),
            getDoc(doc(db, 'settings', 'promotions'))
          ]);

          const stripeSettings = stripeSettingsSnap.data();
          const feesSettings = feesSettingsSnap.data();
          const promotions = promosSnap.exists() ? promosSnap.data() : null;

          for (let i = 0; i < regIds.length; i++) {
            const regId = regIds[i];
            const regRef = doc(db, "registrations", regId);
            const regSnap = await getDoc(regRef);
            
            if (regSnap.exists()) {
              const regData = regSnap.data();
              if (regData.paymentStatus !== "Pago") {
                const isFirst = i === 0;
                const breakdown = calculateDetailedVibyBreakdown(
                  regData.ticketBasePrice || 0,
                  1,
                  feesSettings,
                  stripeSettings,
                  isFirst,
                  promotions
                );

                await updateDoc(regRef, {
                  paymentStatus: "Pago",
                  stripeSessionId: sessionId,
                  updatedAt: serverTimestamp(),
                  confirmedAt: serverTimestamp(),
                  financialSnapshot: breakdown
                });

                const monthKey = new Date().toISOString().slice(0, 7);
                const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString('pt-BR');

                await addDoc(collection(db, "tax_tickets"), {
                   registrationId: regId,
                   eventId: regData.eventId,
                   eventTitle: regData.eventTitle || "Evento",
                   organizationId: regData.organizationId,
                   orgName: regData.organizer?.name || "Organização",
                   orgCnpj: regData.organizer?.cnpj || "---",
                   buyerName: regData.userName || "Comprador",
                   buyerEmail: regData.userEmail || "",
                   ticketTypeName: regData.ticketTypeName || "Geral",
                   batchName: regData.batchName || "Único",
                   sectorName: regData.sectorName || null,
                   quantity: 1,
                   unitPrice: breakdown.unitPrice,
                   totalFacePrice: breakdown.totalFace,
                   buyerFeeAmount: breakdown.buyerFeeTotal,
                   organizerFeeAmount: breakdown.organizerFeeTotal,
                   stripeFeePercentAmount: breakdown.stripeFeePercentAmount,
                   stripeFeeFixedAmount: breakdown.stripeFeeFixedAmount,
                   stripeFeeAmount: breakdown.stripeFeeTotal,
                   vibyGrossProfit: breakdown.vibyGross,
                   taxPercentUsed: 11,
                   taxAmount: breakdown.imposto,
                   vibyNetProfit: breakdown.vibyNet,
                   payoutToProducer: breakdown.payoutToProducer,
                   monthKey,
                   nfDeadlineDate: lastDay,
                   nfStatus: 'pendente',
                   timestamp: serverTimestamp()
                });

                await processGamificationEvent(db, user.uid, 'on_ticket_purchase', {
                  eventId: regData.eventId,
                  eventTitle: regData.eventTitle,
                  categoryName: regData.categoryName,
                  city: regData.eventCity,
                  orgName: regData.organizer?.name
                }, regId, userData);

                const eventDate = regData.eventDate?.toDate ? regData.eventDate.toDate().toLocaleString('pt-BR') : new Date(regData.eventDate).toLocaleString('pt-BR');
                
                await sendTicketEmail({
                  to: regData.userEmail,
                  userName: regData.attendeeName || regData.userName,
                  eventTitle: regData.eventTitle,
                  ticketCode: regData.ticketCode,
                  eventDate: eventDate,
                  eventCity: regData.eventCity || "Local Confirmado",
                  sectorName: regData.sectorName,
                  seatCode: regData.seatCode,
                  batchName: regData.batchName,
                  ticketTypeName: regData.ticketTypeName,
                  voucherUrl: `https://viby.club/dashboard/ingressos/${regId}/voucher`,
                  eventUrl: `https://viby.club/${regData.organizerUsername || 'evento'}/${regData.eventId}`
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

export default function CheckoutSucessoPage() {
  return (
    <React.Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-secondary" />
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Carregando...</p>
      </div>
    }>
      <CheckoutSucessoContent />
    </React.Suspense>
  );
}
