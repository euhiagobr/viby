'use client';

import { serverTimestamp, increment } from "firebase/firestore";
import { FirestoreService } from "@/lib/firestore-safe";
import { createCheckoutSession } from "@/app/actions/stripe";
import { generateUniqueTicketCode } from "@/lib/ticket-utils";
import { calculateFinancialBreakdown } from "@/lib/financial-utils";
import { sendTicketEmail } from "@/app/actions/email";
import { CartItem } from "@/contexts/CartContext";
import { processGamificationEvent } from "@/lib/gamification-service";
import { db } from "@/firebase/database";

/**
 * @fileOverview PayButtonService - O Orquestrador do Novo Checkout Viby.
 * Segue o fluxo de 7 passos para garantir integridade e evitar overselling.
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
  const { user, profile, items, totals, globalFees, promotions, orgsData, useBalance } = options;

  if (!user || !items.length) throw new Error("Dados de checkout incompletos.");

  const isFreeOrder = totals.total <= 0 && totals.balanceUsed === 0;
  const isFullBalanceOrder = totals.total <= 0 && totals.balanceUsed > 0;
  
  const registrationIds: string[] = [];
  const lineItems: any[] = [];

  // PASSO 1, 2 e 3: Validação e Criação de Registros Pendentes
  // Criamos os tickets com status 'Pendente' antes de ir para o Stripe
  for (const item of items) {
    const breakdown = calculateFinancialBreakdown(item.price, globalFees, promotions, orgsData[item.organizationId]);

    for (let i = 0; i < item.quantity; i++) {
      const ticketCode = await generateUniqueTicketCode(db);
      
      const regData = {
        eventId: item.eventId,
        eventTitle: item.eventTitle,
        eventImage: item.eventImage,
        eventDate: item.eventDate,
        eventCity: item.eventCity,
        organizationId: item.organizationId,
        organizerId: item.organizerId,
        organizerUsername: item.organizerUsername,
        userId: user.uid,
        userName: profile?.name || user.displayName || "Participante",
        userEmail: user.email,
        ticketTypeId: item.ticketTypeId,
        ticketTypeName: item.ticketTypeName,
        batchId: item.batchId,
        batchName: item.batchName,
        ticketBasePrice: item.price,
        price: breakdown.customerFinalPrice,
        administrativeFeeAmount: breakdown.administrativeFeeAmount,
        producerFeeAmount: breakdown.producerFeeAmount,
        producerNetAmount: breakdown.producerNetAmount,
        paymentStatus: (isFreeOrder || isFullBalanceOrder) ? "Disponível" : "Pendente",
        confirmedAt: (isFreeOrder || isFullBalanceOrder) ? serverTimestamp() : null,
        ticketCode,
        status: "Ativo",
        timestamp: serverTimestamp()
      };

      const docRef = await FirestoreService.add("registrations", regData);
      registrationIds.push(docRef.id);

      // Se for grátis, já dispara o e-mail agora
      if (isFreeOrder || isFullBalanceOrder) {
        const d = item.eventDate?.toDate ? item.eventDate.toDate() : new Date(item.eventDate);
        await sendTicketEmail({
          to: user.email!,
          userName: regData.userName,
          eventTitle: item.eventTitle,
          ticketCode,
          eventDate: d.toLocaleString('pt-BR'),
          eventCity: item.eventCity,
          voucherUrl: `https://viby.club/dashboard/ingressos/${docRef.id}/voucher`
        });
      }
    }

    // Preparar itens para o Stripe se não for grátis
    if (!isFreeOrder && !isFullBalanceOrder) {
      lineItems.push({
        price_data: {
          currency: 'brl',
          product_data: { 
            name: `${item.eventTitle} - ${item.ticketTypeName}`,
            images: item.eventImage ? [item.eventImage] : []
          },
          unit_amount: Math.round(breakdown.customerFinalPrice * 100)
        },
        quantity: item.quantity
      });
    }
  }

  // PASSO 4: Processar Saldo da Carteira (Ledger)
  if (isFullBalanceOrder || (useBalance && totals.balanceUsed > 0)) {
    const amountToDeduct = totals.balanceUsed;
    await FirestoreService.update("users", user.uid, { walletBalance: increment(-amountToDeduct) });
    await FirestoreService.set("wallets", user.uid, { balance: increment(-amountToDeduct) });
    
    await FirestoreService.add("wallet_transactions", {
      userId: user.uid,
      amount: amountToDeduct,
      type: 'debit',
      reason: 'compra_ingresso',
      description: `Checkout: ${items.length > 1 ? 'Múltiplos itens' : items[0].eventTitle}`,
      timestamp: serverTimestamp()
    });
  }

  // PASSO 5 e 6: Stripe Integration
  if (isFreeOrder || isFullBalanceOrder) {
    // Gamificação para compras grátis/saldo
    await processGamificationEvent(db, user.uid, 'on_ticket_purchase', { count: items.length }, registrationIds[0]);
    return { type: 'internal', registrationIds };
  }

  const stripeResult = await createCheckoutSession({
    eventTitle: items.length > 1 ? "Múltiplos Ingressos" : items[0].eventTitle,
    totalAmount: Math.round(totals.total * 100),
    userEmail: user.email!,
    lineItems: totals.balanceUsed > 0 ? undefined : lineItems, // Se usou saldo parcial, enviamos apenas o valor total consolidado
    metadata: {
      type: "cart_checkout",
      registrationIds: registrationIds.join(","),
      userId: user.uid,
      balanceUsed: totals.balanceUsed.toString()
    }
  });

  if (stripeResult.url) {
    return { type: 'stripe', url: stripeResult.url };
  } else {
    throw new Error(stripeResult.error || "Erro ao gerar link de pagamento.");
  }
}
