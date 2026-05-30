'use client';

import { 
  serverTimestamp, 
  increment, 
  doc, 
  setDoc, 
  collection, 
  addDoc, 
  updateDoc, 
  runTransaction,
  getDoc
} from "firebase/firestore";
import { db as staticDb } from "@/firebase/database";
import { FirestoreService } from "@/lib/firestore-safe";
import { createCheckoutSession } from "@/app/actions/stripe";
import { generateUniqueTicketCode } from "@/lib/ticket-utils";
import { calculateFinancialBreakdown } from "@/lib/financial-utils";
import { CartItem } from "@/contexts/CartContext";

/**
 * @fileOverview Orquestrador de Pagamentos Viby - Nova Arquitetura de Integridade.
 * ATUALIZADO: Controle atômico de capacidade para eventos gratuitos.
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

  console.log("[TRACE-VIBY] Checkout Flow Pipeline");
  if (!user) throw new Error("Usuário não identificado.");
  
  const isFreeOrder = totals.total <= 0 && totals.balanceUsed === 0;

  // PASSO 1: Para ordens gratuitas, fluxo atômico para respeitar capacidade
  if (isFreeOrder) {
    console.log("STEP: Processing FREE Order with Atomic Transaction");
    
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

      // Validar capacidade de todos os alvos
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

        // Incrementar contadores
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

      // Emitir registros
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
  console.log("STEP: Creating Pending Order");
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
  console.log("STEP: Preparing Stripe Session");
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
