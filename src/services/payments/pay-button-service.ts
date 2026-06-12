
'use client';

import { 
  doc, 
  collection, 
  addDoc, 
  updateDoc, 
  getDoc,
  serverTimestamp,
  runTransaction,
  increment,
  query,
  where,
  getDocs,
  limit
} from "firebase/firestore";
import { db as staticDb } from "@/firebase/database";
import { createCheckoutSession } from "@/app/actions/stripe";
import { generateFreeTickets } from "@/app/actions/tickets";
import { calculateVibyOfficialSplit, toCents, calculateFinancialBreakdown } from "@/lib/financial-utils";
import { CartItem } from "@/contexts/CartContext";
import { CurrencyCode } from "@/contexts/CurrencyContext";

export interface PayButtonOptions {
  user: any;
  profile: any;
  items: CartItem[];
  totals: any;
  globalFees: any;
  promotions: any;
  orgsData: Record<string, any>;
  useBalance: boolean;
  rates?: Record<string, number>;
}

export async function executeCheckoutFlow(options: PayButtonOptions) {
  const { user, profile, items, totals, useBalance, rates, globalFees, promotions, orgsData } = options;

  if (!user) throw new Error("Usuário não identificado.");
  if (!items || items.length === 0) throw new Error("O carrinho está vazio.");

  const currenciesInCart = new Set(items.map(i => i.currency || 'BRL'));
  if (currenciesInCart.size > 1) {
    throw new Error("Não é possível realizar checkout com múltiplas moedas. Remova os itens divergentes.");
  }

  for (const item of items) {
    const eSnap = await getDoc(doc(staticDb, "events", item.eventId));
    if (!eSnap.exists()) throw new Error(`O evento ${item.eventTitle} não está mais disponível.`);
    
    const event = eSnap.data();
    const batch = event.batches?.find((b: any) => b.id === item.batchId);
    const type = batch?.ticketTypes?.find((t: any) => t.id === item.ticketTypeId);

    if (!batch || !type || type.quantity < item.quantity) {
      throw new Error(`A disponibilidade para o lote "${item.batchName}" mudou.`);
    }

    if (item.price === 0) {
      const lockId = `free_lock_${user.uid}_${item.eventId}_${item.ticketTypeId}`;
      const lockSnap = await getDoc(doc(staticDb, "registrations_locks", lockId));
      if (lockSnap.exists()) throw new Error("Você já resgatou este ingresso gratuito.");
    }
  }
  
  const isFreeOrder = totals.total <= 0 && totals.balanceUsed === 0;
  const eventCurrency = (items[0]?.currency || 'BRL') as CurrencyCode;

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

  const exchangeRateToBRL = eventCurrency === 'BRL' ? 1 : (1 / (rates?.[eventCurrency] || 1));
  const exchangeDate = new Date().toISOString().slice(0, 10);

  // EVIDÊNCIA: Preparação do registro de Ordem antes do Checkout
  const orderItems = items.map(item => {
    const breakdown = calculateFinancialBreakdown(item.price, globalFees, promotions, orgsData[item.organizationId], eventCurrency, rates);
    return {
      ...item,
      producerNetAmount: breakdown.producerNetAmount,
      administrativeFeeAmount: breakdown.administrativeFeeAmount,
      financials: breakdown
    };
  });

  const orderData = {
    userId: user.uid,
    userEmail: user.email,
    userName: profile?.name || user.displayName || "Comprador",
    items: orderItems,
    currency: eventCurrency,
    exchangeData: {
      rate: exchangeRateToBRL,
      date: exchangeDate,
      originalRates: rates || {}
    },
    totals: {
      subtotal: totals.subtotal,
      fees: totals.fees,
      balanceUsed: totals.balanceUsed,
      totalToPay: totals.total
    },
    status: 'pending',
    createdAt: serverTimestamp()
  };

  if (useBalance && totals.balanceUsed > 0 && eventCurrency === 'BRL') {
    await runTransaction(staticDb, async (transaction) => {
      const walletRef = doc(staticDb, "wallets", user.uid);
      const wSnap = await transaction.get(walletRef);
      if (!wSnap.exists() || (wSnap.data().balance || 0) < totals.balanceUsed) {
        throw new Error("Saldo insuficiente na carteira.");
      }
      transaction.update(walletRef, { balance: increment(-totals.balanceUsed), updatedAt: serverTimestamp() });
    });
  }

  const orderRef = await addDoc(collection(staticDb, "orders"), orderData);

  // EVIDÊNCIA: Cálculo de application_fee_amount (centavos)
  let balanceToSubtractCents = toCents(totals.balanceUsed);
  let totalApplicationFeeCents = 0;

  const stripeLineItems = items.map((item) => {
    const split = calculateVibyOfficialSplit(item.price, eventCurrency, rates, orgsData[item.organizationId]);
    
    // SOMA DAS TAXAS (MARKUP + COMISSÃO) PARA O STRIPE RETER
    totalApplicationFeeCents += toCents(split.vibyApplicationFee) * item.quantity;
    
    let unitAmountCents = toCents(split.totalCharged);
    
    if (balanceToSubtractCents > 0 && eventCurrency === 'BRL') {
      const maxSub = unitAmountCents * item.quantity;
      const actualSub = Math.min(balanceToSubtractCents, maxSub);
      unitAmountCents = Math.round((maxSub - actualSub) / item.quantity);
      balanceToSubtractCents -= actualSub;
    }

    return {
      price_data: {
        currency: eventCurrency.toLowerCase(),
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

  if (!stripeAccountId) throw new Error("A marca não configurou o Stripe para recebimentos.");

  const stripeResult = await createCheckoutSession({
    userEmail: user.email!,
    lineItems: stripeLineItems,
    currency: eventCurrency.toLowerCase(),
    totalApplicationFeeCents,
    destinationStripeAccount: stripeAccountId, // EVIDÊNCIA: Destino do Split
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
