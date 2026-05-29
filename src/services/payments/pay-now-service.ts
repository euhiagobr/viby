'use client';

import { Firestore, serverTimestamp, increment, runTransaction, addDoc, doc, collection } from "firebase/firestore";
import { safeCollection, safeDoc } from "@/lib/firestore-safe";
import { createCheckoutSession } from "@/app/actions/stripe";
import { generateUniqueTicketCode } from "@/lib/ticket-utils";
import { calculateFinancialBreakdown } from "@/lib/financial-utils";
import { sendTicketEmail } from "@/app/actions/email";
import { CartItem } from "@/contexts/CartContext";

/**
 * @fileOverview PayNowService - O núcleo de processamento de pagamentos da Viby.
 * Orquestra a criação de pedidos, reserva de saldo e integração com o Stripe.
 */

export interface CheckoutOptions {
  user: any;
  profile: any;
  items: CartItem[];
  totals: {
    total: number;
    subtotal: number;
    fees: number;
    discount: number;
    balanceUsed: number;
  };
  globalFees: any;
  promotions: any;
  orgsData: Record<string, any>;
  useBalance: boolean;
  onSuccess?: () => void;
  onError?: (error: any) => void;
}

export async function processPayNow(db: Firestore, options: CheckoutOptions) {
  const { user, profile, items, totals, globalFees, promotions, orgsData } = options;

  if (!user || !db) throw new Error("Usuário ou banco de dados não disponível.");

  const isFullBalanceOrder = totals.total <= 0 && totals.balanceUsed > 0;
  const isFreeOrder = totals.total <= 0 && totals.balanceUsed === 0;

  const registrationIds: string[] = [];
  const lineItems: any[] = [];

  // 1. Processar Saldo da Carteira se necessário
  if (isFullBalanceOrder) {
    await runTransaction(db, async (transaction) => {
      const walletRef = safeDoc(db, "wallets", user.uid);
      const userRef = safeDoc(db, "users", user.uid);
      const wSnap = await transaction.get(walletRef);
      
      if (!wSnap.exists() || (wSnap.data().balance || 0) < totals.balanceUsed) {
        throw new Error("Saldo insuficiente na carteira para esta operação.");
      }

      transaction.set(walletRef, { 
        balance: increment(-totals.balanceUsed), 
        updatedAt: serverTimestamp() 
      }, { merge: true });

      transaction.update(userRef, { 
        walletBalance: increment(-totals.balanceUsed), 
        updatedAt: serverTimestamp() 
      });

      const txRef = safeDoc(safeCollection(db, "wallet_transactions"), crypto.randomUUID());
      transaction.set(txRef, { 
        userId: user.uid, 
        amount: totals.balanceUsed, 
        type: 'debit', 
        reason: 'compra_ingresso', 
        description: `Compra Integral com Saldo`, 
        timestamp: serverTimestamp() 
      });
    });
  }

  // 2. Criar Registros e Preparar Stripe
  for (const item of items) {
    const breakdown = calculateFinancialBreakdown(item.price, globalFees, promotions, orgsData[item.organizationId]);

    for (let i = 0; i < item.quantity; i++) {
      const ticketCode = await generateUniqueTicketCode(db);
      
      const regData = {
        ...item,
        userId: user.uid,
        userName: profile?.name || user.displayName || user.email || "Usuário",
        userEmail: user.email,
        ticketBasePrice: item.price,
        price: breakdown.customerFinalPrice,
        administrativeFeeAmount: breakdown.administrativeFeeAmount,
        producerFeeAmount: breakdown.producerFeeAmount,
        producerNetAmount: breakdown.producerNetAmount,
        paymentStatus: (isFreeOrder || isFullBalanceOrder) ? "Disponível" : "Pendente",
        confirmedAt: (isFreeOrder || isFullBalanceOrder) ? serverTimestamp() : null,
        ticketCode,
        status: "Ativo",
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp()
      };

      // Usando wrapper seguro para evitar crash
      const regRef = await addDoc(safeCollection(db, "registrations"), regData);
      registrationIds.push(regRef.id);
      
      if (isFreeOrder || isFullBalanceOrder) {
        await sendTicketEmail({ 
          to: user.email!, 
          userName: profile?.name || user.displayName || "Participante", 
          eventTitle: item.eventTitle, 
          ticketCode, 
          eventDate: item.eventDate, 
          eventCity: item.eventCity, 
          voucherUrl: `https://viby.club/dashboard/ingressos/${regRef.id}/voucher` 
        });
      }
    }

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

  // 3. Finalizar Fluxo
  if (isFreeOrder || isFullBalanceOrder) {
    return { type: 'internal', registrationIds };
  } else {
    const result = await createCheckoutSession({
      eventTitle: items.length > 1 ? "Múltiplos Ingressos" : items[0].eventTitle,
      totalAmount: Math.round(totals.total * 100),
      userEmail: user.email!,
      lineItems: totals.balanceUsed > 0 ? undefined : lineItems,
      metadata: { 
        type: "cart_checkout", 
        registrationIds: registrationIds.join(","), 
        userId: user.uid, 
        balanceUsed: totals.balanceUsed.toString() 
      }
    });

    if (result.url) {
      return { type: 'stripe', url: result.url };
    } else {
      throw new Error(result.error || "Erro ao gerar link de pagamento.");
    }
  }
}
