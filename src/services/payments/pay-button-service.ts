
'use client';

import { 
  doc, 
  collection, 
  addDoc, 
  updateDoc, 
  getDoc,
  serverTimestamp,
  runTransaction,
  increment
} from "firebase/firestore";
import { db as staticDb } from "@/firebase/database";
import { createCheckoutSession } from "@/app/actions/stripe";
import { generateFreeTickets } from "@/app/actions/tickets";
import { calculateVibyOfficialSplit, calculateFinancialBreakdown, toCents } from "@/lib/financial-utils";
import { CartItem } from "@/contexts/CartContext";

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

/**
 * @fileOverview Lógica central de checkout com suporte a abatimento de saldo da carteira.
 * CRÍTICO: O valor de saldo utilizado deve reduzir o montante final enviado ao Stripe.
 */
export async function executeCheckoutFlow(options: PayButtonOptions) {
  const { user, profile, items, totals, useBalance } = options;

  if (!user) throw new Error("Usuário não identificado.");

  // Validação de estoque preliminar
  for (const item of items) {
    const eSnap = await getDoc(doc(staticDb, "events", item.eventId));
    if (!eSnap.exists()) throw new Error(`O evento ${item.eventTitle} não está mais disponível.`);
    
    const event = eSnap.data();
    const batch = event.batches?.find((b: any) => b.id === item.batchId);
    const type = batch?.ticketTypes?.find((t: any) => t.id === item.ticketTypeId);

    if (!batch || !type || type.quantity < item.quantity) {
      throw new Error(`A disponibilidade para o lote "${item.batchName}" mudou.`);
    }
  }
  
  const isFreeOrder = totals.total <= 0 && totals.balanceUsed === 0;

  // 1. FLUXO GRATUITO
  if (isFreeOrder) {
    const result = await generateFreeTickets({
      userId: user.uid,
      userName: profile?.name || user.displayName || "Comprador",
      userEmail: user.email!,
      items: items
    });
    if (!result.success) throw new Error(result.error);
    return { type: 'free', success: true };
  }

  // 2. FLUXO PAGO / SALDO (Stripe Connect)
  const processedItems = items.map(item => {
    return { ...item, financials: calculateFinancialBreakdown(item.price) };
  });

  const orderData = {
    userId: user.uid,
    userEmail: user.email,
    userName: profile?.name || user.displayName || "Comprador",
    items: processedItems,
    totals: {
      subtotal: totals.subtotal,
      fees: totals.fees,
      balanceUsed: totals.balanceUsed,
      totalToPay: totals.total
    },
    status: 'pending',
    createdAt: serverTimestamp()
  };

  // Gravação transacional do abatimento de saldo (se houver)
  if (useBalance && totals.balanceUsed > 0) {
    await runTransaction(staticDb, async (transaction) => {
      const walletRef = doc(staticDb, "wallets", user.uid);
      const userRef = doc(staticDb, "users", user.uid);
      const wSnap = await transaction.get(walletRef);

      if (!wSnap.exists() || (wSnap.data().balance || 0) < totals.balanceUsed) {
        throw new Error("Saldo insuficiente na carteira.");
      }

      transaction.update(walletRef, { 
        balance: increment(-totals.balanceUsed), 
        updatedAt: serverTimestamp() 
      });
      transaction.update(userRef, { 
        walletBalance: increment(-totals.balanceUsed), 
        updatedAt: serverTimestamp() 
      });
      
      const txRef = doc(collection(staticDb, "wallet_transactions"));
      transaction.set(txRef, {
        userId: user.uid,
        amount: totals.balanceUsed,
        type: 'debit',
        reason: 'compra_ingresso',
        description: `Abatimento em Pedido`,
        timestamp: serverTimestamp()
      });
    });
  }

  const orderRef = await addDoc(collection(staticDb, "orders"), orderData);

  // CORREÇÃO CRÍTICA 02: O valor enviado ao Stripe deve ser totals.total (Já subtraído o saldo)
  // Como o Stripe não aceita valores negativos em line_items sem cupons, 
  // diluímos o desconto proporcionalmente ou aplicamos no montante final do PaymentIntent.
  // Aqui utilizaremos uma abordagem de ajuste no primeiro item para simplificar o Split.
  
  let balanceToSubtractCents = toCents(totals.balanceUsed);
  let totalApplicationFeeCents = 0;

  const stripeLineItems = processedItems.map((item, idx) => {
    const split = calculateVibyOfficialSplit(item.price);
    totalApplicationFeeCents += toCents(split.vibyApplicationFee) * item.quantity;
    
    let unitAmountCents = toCents(split.totalCharged);
    
    // Subtrai o saldo utilizado do valor que o usuário pagará no Stripe
    if (balanceToSubtractCents > 0) {
      const maxSub = unitAmountCents * item.quantity;
      const actualSub = Math.min(balanceToSubtractCents, maxSub);
      unitAmountCents = Math.round((maxSub - actualSub) / item.quantity);
      balanceToSubtractCents -= actualSub;
    }

    return {
      price_data: {
        currency: 'brl',
        product_data: {
          name: `${item.eventTitle} - ${item.ticketTypeName}`,
          description: `Lote: ${item.batchName}`,
          images: item.eventImage ? [item.eventImage] : []
        },
        unit_amount: unitAmountCents,
      },
      quantity: item.quantity,
    };
  });

  const orgDoc = await getDoc(doc(staticDb, "organizations", items[0].organizationId));
  const stripeAccountId = orgDoc.data()?.stripeAccountId;

  if (!stripeAccountId) throw new Error("A marca não configurou o Stripe.");

  const stripeResult = await createCheckoutSession({
    userEmail: user.email!,
    lineItems: stripeLineItems,
    totalApplicationFeeCents,
    destinationStripeAccount: stripeAccountId,
    metadata: {
      type: "order_checkout",
      orderId: orderRef.id,
      userId: user.uid,
      balanceUsed: totals.balanceUsed.toString()
    }
  });

  if (!stripeResult.success) {
    await updateDoc(orderRef, { status: 'failed', error: stripeResult.error });
    throw new Error(stripeResult.error);
  }

  return { type: 'stripe', url: stripeResult.url };
}
