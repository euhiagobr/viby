'use client';

import { serverTimestamp, increment, doc, setDoc, collection, addDoc, updateDoc } from "firebase/firestore";
import { db as staticDb } from "@/firebase/database";
import { FirestoreService } from "@/lib/firestore-safe";
import { createCheckoutSession } from "@/app/actions/stripe";
import { generateUniqueTicketCode } from "@/lib/ticket-utils";
import { calculateFinancialBreakdown } from "@/lib/financial-utils";
import { CartItem } from "@/contexts/CartContext";

/**
 * @fileOverview Orquestrador de Pagamentos Viby - Nova Arquitetura de Integridade.
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

  // PASSO 1: Para ordens gratuitas, o fluxo permanece imediato
  if (isFreeOrder) {
    console.log("STEP: Processing FREE Order");
    const registrationIds: string[] = [];
    for (const item of items) {
      const breakdown = calculateFinancialBreakdown(item.price, globalFees, promotions, orgsData[item.organizationId]);
      for (let i = 0; i < item.quantity; i++) {
        const ticketCode = await generateUniqueTicketCode(staticDb);
        const regData = {
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
          timestamp: serverTimestamp()
        };
        const docRef = await FirestoreService.add("registrations", regData);
        registrationIds.push(docRef.id);
      }
    }
    return { type: 'free', success: true };
  }

  // PASSO 2: Para ordens PAGAS, criamos um registro de PEDIDO (Order)
  // O ingresso REAL só será criado após o webhook/sucesso do Stripe.
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
    // Marcar order como falha se o Stripe nem abrir
    await updateDoc(orderRef, { status: 'failed', error: stripeResult.error });
    throw new Error(stripeResult.error || "Erro ao iniciar checkout.");
  }

  return { type: 'stripe', url: stripeResult.url };
}
