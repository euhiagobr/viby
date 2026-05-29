'use client';

import { serverTimestamp } from "firebase/firestore";
import { FirestoreService } from "@/lib/firestore-safe";
import { createCheckoutSession } from "@/app/actions/stripe";
import { generateUniqueTicketCode } from "@/lib/ticket-utils";
import { calculateFinancialBreakdown } from "@/lib/financial-utils";
import { CartItem } from "@/contexts/CartContext";
import { db as staticDb } from "@/firebase/database";

/**
 * @fileOverview Orquestrador de Pagamentos Viby.
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
  
  const isFreeOrder = totals.total <= 0 && totals.balanceUsed === 0;
  const registrationIds: string[] = [];

  // 1. Criar pré-registros (tickets pendentes)
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
        price: breakdown.customerFinalPrice,
        administrativeFeeAmount: breakdown.administrativeFeeAmount,
        producerFeeAmount: breakdown.producerFeeAmount,
        producerNetAmount: breakdown.producerNetAmount,
        ticketTypeName: item.ticketTypeName,
        batchName: item.batchName,
        paymentStatus: isFreeOrder ? "Disponível" : "Pendente",
        ticketCode,
        status: "Ativo",
        timestamp: serverTimestamp()
      };

      const docRef = await FirestoreService.add("registrations", regData);
      registrationIds.push(docRef.id);
    }
  }

  // 2. Se for grátis, encerra aqui
  if (isFreeOrder) {
    return { type: 'free', success: true };
  }

  // 3. Iniciar Sessão no Stripe
  const stripeResult = await createCheckoutSession({
    eventTitle: items.length > 1 ? "Múltiplos Ingressos" : items[0].eventTitle,
    totalAmount: Math.round(totals.total * 100),
    userEmail: user.email!,
    metadata: {
      type: "cart_checkout",
      registrationIds: registrationIds.join(","),
      userId: user.uid,
      balanceUsed: totals.balanceUsed.toString()
    }
  });

  if (!stripeResult.success) {
    throw new Error(stripeResult.error || "Erro ao iniciar checkout.");
  }

  return { type: 'stripe', url: stripeResult.url };
}
