'use client';

import { 
  serverTimestamp, 
  increment, 
  doc, 
  collection, 
  addDoc, 
  updateDoc, 
  runTransaction,
  getDoc
} from "firebase/firestore";
import { db as staticDb } from "@/firebase/database";
import { createCheckoutSession } from "@/app/actions/stripe";
import { calculateFinancialBreakdown } from "@/lib/financial-utils";
import { CartItem } from "@/contexts/CartContext";

/**
 * @fileOverview Orquestrador de Pagamentos Viby - Nova Arquitetura de Integridade.
 * Inclui validação final de disponibilidade e lotes antes do checkout.
 */

export interface PayButtonOptions {
  user: any;
  profile: any;
  items: CartItem[];
  totals: any;
  globalFees: any;
  promotions: any;
  orgsData: Record<string, any>;
  useBalance: boolean;
}

export async function executeCheckoutFlow(options: PayButtonOptions) {
  const { user, profile, items, totals, globalFees, promotions, orgsData } = options;

  if (!user) throw new Error("Usuário não identificado.");

  // VALIDAÇÃO PRÉ-CHECKOUT: Garante que os lotes e capacidades ainda estão válidos
  for (const item of items) {
    const eSnap = await getDoc(doc(staticDb, "events", item.eventId));
    if (!eSnap.exists()) throw new Error(`O evento ${item.eventTitle} não está mais disponível.`);
    
    const event = eSnap.data();
    const batch = event.batches?.find((b: any) => b.id === item.batchId);
    const type = batch?.ticketTypes?.find((t: any) => t.id === item.ticketTypeId);

    if (!batch || !type || type.quantity < item.quantity) {
      throw new Error(`A disponibilidade para o lote "${item.batchName}" do evento "${item.eventTitle}" mudou. Por favor, revise seu carrinho.`);
    }
  }
  
  const isFreeOrder = totals.total <= 0 && totals.balanceUsed === 0;

  // PASSO 1: Para ordens gratuitas, fluxo atômico para respeitar capacidade
  if (isFreeOrder) {
    return await runTransaction(staticDb, async (transaction) => {
      const targets: Record<string, { ref: any, parentRef?: any, qty: number }> = {};
      
      for (const item of items) {
        const key = item.occurrenceId ? `occ_${item.occurrenceId}` : `ev_${item.eventId}`;
        if (!targets[key]) {
          targets[key] = {
            ref: item.occurrenceId ? doc(staticDb, "recurring_occurrences", item.occurrenceId) : doc(staticDb, "events", item.eventId),
            parentRef: item.occurrenceId ? doc(staticDb, "events", item.eventId) : undefined,
            qty: 0
          };
        }
        targets[key].qty += (item.quantity || 1);
      }

      for (const key in targets) {
        const target = targets[key];
        const snap = await transaction.get(target.ref);
        if (!snap.exists()) throw new Error("Evento ou data não localizada.");
        
        const data = snap.data()!;
        const currentSold = data.ingressosVendidos || 0;
        const capacity = data.capacidadeMaxima || data.capacidadeTotal || 0;

        if (capacity > 0 && (currentSold + target.qty > capacity)) {
          throw new Error(`Infelizmente não há mais vagas para ${data.name || data.title}.`);
        }

        transaction.update(target.ref, { 
          ingressosVendidos: increment(target.qty),
          updatedAt: serverTimestamp()
        });

        if (target.parentRef) {
          transaction.update(target.parentRef, {
            ingressosVendidos: increment(target.qty),
            updatedAt: serverTimestamp()
          });
        }
      }

      const registrationIds: string[] = [];
      for (const item of items) {
        for (let i = 0; i < item.quantity; i++) {
          const ticketCode = Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
          const regRef = doc(collection(staticDb, "registrations"));
          
          transaction.set(regRef, {
            eventId: item.eventId,
            eventTitle: item.eventTitle,
            eventImage: item.eventImage || '',
            eventDate: item.eventDate,
            eventCity: item.eventCity,
            userId: user.uid,
            userName: profile?.name || user.displayName || "Comprador",
            userEmail: user.email,
            ticketBasePrice: item.price,
            price: 0,
            administrativeFeeAmount: 0,
            producerFeeAmount: 0,
            producerNetAmount: 0,
            ticketTypeName: item.ticketTypeName,
            batchName: item.batchName,
            paymentStatus: "Disponível",
            status: "Ativo",
            ticketCode,
            occurrenceId: item.occurrenceId || null,
            confirmedAt: serverTimestamp(),
            timestamp: serverTimestamp()
          });
          registrationIds.push(regRef.id);
        }
      }

      return { type: 'free', success: true, registrationIds };
    });
  }

  // PASSO 2: Para ordens PAGAS, criamos um registro de PEDIDO (Order)
  const orderData = {
    userId: user.uid,
    userEmail: user.email,
    userName: profile?.name || user.displayName || "Comprador",
    items: items.map(item => ({
      ...item,
      financials: calculateFinancialBreakdown(item.price, globalFees, promotions, orgsData[item.organizationId])
    })),
    totals: {
      subtotal: totals.subtotal,
      fees: totals.fees,
      balanceUsed: totals.balanceUsed,
      totalToPay: totals.total
    },
    status: 'pending',
    createdAt: serverTimestamp()
  };

  const orderRef = await addDoc(collection(staticDb, "orders"), orderData);

  // PASSO 3: Iniciar Sessão no Stripe com o OrderID no metadata
  const stripeResult = await createCheckoutSession({
    eventTitle: items.length > 1 ? "Múltiplos Ingressos" : items[0].eventTitle,
    totalAmount: Math.round(totals.total * 100),
    userEmail: user.email!,
    metadata: {
      type: "order_checkout",
      orderId: orderRef.id,
      userId: user.uid,
      balanceUsed: totals.balanceUsed.toString()
    }
  });

  if (!stripeResult.success) {
    await updateDoc(orderRef, { status: 'failed', error: stripeResult.error });
    throw new Error(stripeResult.error || "Erro ao iniciar checkout.");
  }

  return { type: 'stripe', url: stripeResult.url };
}
