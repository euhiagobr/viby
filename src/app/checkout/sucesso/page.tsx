
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

        // Caso 1: Recarga de Anúncios
        if (metadata.type === 'ad_balance_topup') {
          const orgRef = doc(db, "organizations", metadata.orgId);
          const amountToCredit = parseFloat(metadata.baseAmount);
          await updateDoc(orgRef, {
            adBalance: increment(amountToCredit),
            updatedAt: serverTimestamp()
          });
          toast({ title: "Saldo Recarregado!" });
        } 
        // Caso 2: Checkout de Pedido (Ingressos)
        else if (metadata.type === 'order_checkout' && metadata.orderId) {
          const orderRef = doc(db, "orders", metadata.orderId);
          const orderSnap = await getDoc(orderRef);
          
          if (!orderSnap.exists()) {
             throw new Error("Pedido não localizado.");
          }

          const orderData = orderSnap.data();
          if (orderData.status === 'paid') {
             setLoading(false);
             return;
          }

          const balanceUsed = parseFloat(metadata.balanceUsed || "0");
          if (balanceUsed > 0) {
            await updateDoc(doc(db, "users", user.uid), { walletBalance: increment(-balanceUsed) });
            await setDoc(doc(db, "wallets", user.uid), { balance: increment(-balanceUsed) }, { merge: true });
            await addDoc(collection(db, "wallet_transactions"), {
              userId: user.uid, amount: balanceUsed, type: 'debit', reason: 'compra_ingresso', timestamp: serverTimestamp()
            });
          }

          const [stripeSettingsSnap, feesSettingsSnap, promosSnap] = await Promise.all([
            getDoc(doc(db, 'settings', 'stripe')),
            getDoc(doc(db, 'settings', 'fees')),
            getDoc(doc(db, 'settings', 'promotions'))
          ]);

          for (let i = 0; i < orderData.items.length; i++) {
            const item = orderData.items[i];
            
            // Verificação de Integridade de Organização
            let orgId = item.organizationId;
            let orgName = item.organizerUsername || "Organização";

            // Se for recorrente e estiver faltando orgId, tenta buscar na ocorrência
            if (!orgId && item.occurrenceId) {
               const occSnap = await getDoc(doc(db, "recurring_occurrences", item.occurrenceId));
               if (occSnap.exists()) {
                  const occData = occSnap.data();
                  orgId = occData.organizationId;
                  orgName = occData.orgUsername || orgName;
               }
            }

            for (let j = 0; j < item.quantity; j++) {
              const ticketCode = Math.random().toString(36).substring(2, 10).toUpperCase();
              const breakdown = calculateDetailedVibyBreakdown(
                item.price, 1, feesSettingsSnap.data(), stripeSettingsSnap.data(), (i === 0 && j === 0), promosSnap.data()
              );

              // Formatar título do registro fiscal e data de exibição para recorrência
              let fiscalTitle = item.eventTitle;
              let displayDateForEmail = "Data a confirmar";
              try {
                if (item.occurrenceId) {
                  const dateStr = typeof item.eventDate === 'string' ? item.eventDate : "";
                  fiscalTitle = `${item.eventTitle} (${new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR')})`;
                  displayDateForEmail = new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                } else {
                  const d = item.eventDate?.toDate ? item.eventDate.toDate() : new Date(item.eventDate);
                  displayDateForEmail = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                }
              } catch(e) {}

              const regRef = await addDoc(collection(db, "registrations"), {
                eventId: item.eventId,
                eventTitle: fiscalTitle, // Salvamos o título já com a data para clareza
                eventImage: item.eventImage || '',
                eventDate: item.eventDate,
                eventCity: item.eventCity,
                userId: user.uid,
                userName: orderData.userName,
                userEmail: orderData.userEmail,
                organizationId: orgId, 
                ticketBasePrice: item.price,
                price: item.financials.customerFinalPrice,
                administrativeFeeAmount: item.financials.administrativeFeeAmount,
                producerFeeAmount: item.financials.producerFeeAmount,
                producerNetAmount: item.financials.producerNetAmount,
                ticketTypeName: item.ticketTypeName,
                batchName: item.batchName,
                paymentStatus: "Pago",
                status: "Ativo",
                ticketCode,
                stripeSessionId: sessionId,
                orderId: metadata.orderId,
                occurrenceId: item.occurrenceId || null,
                horarioOcorrencia: item.horarioOcorrencia || null,
                confirmedAt: serverTimestamp(),
                financialSnapshot: breakdown,
                timestamp: serverTimestamp()
              });

              // Registro Fiscal para ERP
              await addDoc(collection(db, "tax_tickets"), {
                 registrationId: regRef.id,
                 eventId: item.eventId,
                 occurrenceId: item.occurrenceId || null,
                 eventTitle: fiscalTitle,
                 organizationId: orgId,
                 orgName: orgName,
                 buyerName: orderData.userName,
                 ticketTypeName: item.ticketTypeName,
                 totalFacePrice: item.price,
                 vibyNetProfit: breakdown.vibyNet,
                 taxAmount: breakdown.imposto,
                 payoutToProducer: breakdown.payoutToProducer,
                 monthKey: new Date().toISOString().slice(0, 7),
                 nfStatus: 'pendente',
                 timestamp: serverTimestamp()
              });

              if (item.occurrenceId) {
                await updateDoc(doc(db, "recurring_occurrences", item.occurrenceId), {
                  ingressosVendidos: increment(1)
                });
              }

              await sendTicketEmail({
                to: orderData.userEmail,
                userName: orderData.userName,
                eventTitle: item.eventTitle,
                ticketCode: ticketCode,
                eventDate: displayDateForEmail,
                voucherUrl: `https://viby.club/dashboard/ingressos/${regRef.id}/voucher`
              });
            }
          }

          await updateDoc(orderRef, { status: 'paid', stripeSessionId: sessionId, updatedAt: serverTimestamp() });
          
          clearCart();
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
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Finalizando transação...</p>
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
                <Link href="/dashboard">Ir para Meus Ingressos <ArrowRight className="ml-2 w-5 h-5" /></Link>
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
