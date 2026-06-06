'use client';

import { 
  serverTimestamp, 
  increment, 
  runTransaction, 
  addDoc 
} from "firebase/firestore";
import { safeCollection, safeDoc } from "@/lib/firestore-safe";
import { createCheckoutSession } from "@/app/actions/stripe";
import { generateUniqueTicketCode } from "@/lib/ticket-utils";
import { calculateFinancialBreakdown } from "@/lib/financial-utils";
import { sendTicketEmail } from "@/app/actions/email";
import { CartItem } from "@/contexts/CartContext";
import { db as staticDb } from "@/firebase/database";

/**
 * @fileOverview PayNowService - Processamento central de pagamentos.
 * Corrigido para utilizar a moeda dinâmica do evento (event.currency) em vez de BRL fixo.
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

export async function processPayNow(_dbUnused: any, options: CheckoutOptions) {
  const { user, profile, items, totals, globalFees, promotions, orgsData } = options;
  
  const firestore = staticDb;

  if (!user || !firestore) {
    throw new Error("Usuário não autenticado ou banco de dados indisponível.");
  }

  const isFullBalanceOrder = totals.total <= 0 && totals.balanceUsed > 0;
  const isFreeOrder = totals.total <= 0 && totals.balanceUsed === 0;

  const registrationIds: string[] = [];
  const lineItems: any[] = [];
  
  // A moeda da transação é definida pela moeda do primeiro item (Viby processa carrinhos por organização)
  const transactionCurrency = (items[0]?.currency || 'BRL').toLowerCase();

  // 1. Processar Saldo da Carteira (Apenas se a moeda do evento for BRL)
  if (isFullBalanceOrder) {
    if (transactionCurrency !== 'brl') {
      throw new Error("O saldo da carteira só pode ser utilizado para eventos precificados em Real (BRL).");
    }

    await runTransaction(firestore, async (transaction) => {
      const walletRef = safeDoc(firestore, "wallets", user.uid);
      const userRef = safeDoc(firestore, "users", user.uid);
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

      const txRef = safeDoc(firestore, "wallet_transactions", crypto.randomUUID());
      transaction.set(txRef, { 
        userId: user.uid, 
        amount: totals.balanceUsed, 
        type: 'debit', 
        reason: 'compra_ingresso', 
        description: `Compra com Saldo: ${items.length > 1 ? 'Múltiplos itens' : items[0].eventTitle}`, 
        timestamp: serverTimestamp() 
      });
    });
  }

  // 2. Criar Registros e Preparar Checkout
  for (const item of items) {
    const breakdown = calculateFinancialBreakdown(item.price, globalFees, promotions, orgsData[item.organizationId], item.currency as any);

    for (let i = 0; i < item.quantity; i++) {
      const ticketCode = await generateUniqueTicketCode(firestore);
      
      const regData = {
        ...item,
        userId: user.uid,
        userName: profile?.name || user.displayName || user.email || "Usuário",
        userEmail: user.email,
        ticketBasePrice: item.price,
        price: breakdown.customerFinalPrice,
        currency: item.currency || 'BRL',
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

      const regRef = await addDoc(safeCollection(firestore, "registrations"), regData);
      registrationIds.push(regRef.id);
      
      if (isFreeOrder || isFullBalanceOrder) {
        const d = item.eventDate?.toDate ? item.eventDate.toDate() : new Date(item.eventDate);
        await sendTicketEmail({ 
          to: user.email!, 
          userName: profile?.name || user.displayName || "Participante", 
          eventTitle: item.eventTitle, 
          ticketCode, 
          eventDate: d.toLocaleString('pt-BR'), 
          eventCity: item.eventCity, 
          voucherUrl: `https://viby.club/dashboard/ingressos/${regRef.id}/voucher` 
        });
      }
    }

    if (!isFreeOrder && !isFullBalanceOrder) {
      lineItems.push({
        price_data: { 
          currency: transactionCurrency, 
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

  if (isFreeOrder || isFullBalanceOrder) {
    return { type: 'internal', registrationIds };
  }

  // 3. Checkout Stripe
  const stripeResult = await createCheckoutSession({
    eventTitle: items.length > 1 ? "Múltiplos Ingressos" : items[0].eventTitle,
    totalAmount: Math.round(totals.total * 100),
    userEmail: user.email!,
    lineItems: lineItems,
    currency: transactionCurrency,
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
    throw new Error(stripeResult.error || "Falha ao gerar link de pagamento.");
  }
}
