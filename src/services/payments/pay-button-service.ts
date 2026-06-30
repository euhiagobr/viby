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
import { calculateVibyOfficialSplit, toCents, calculateFinancialBreakdown, ProductType } from "@/lib/financial-utils";
import { CartItem } from "@/contexts/CartContext";
import { CurrencyCode } from "@/contexts/CurrencyCode";

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

/**
 * Executa o fluxo de checkout garantindo a injeção correta da hierarquia de taxas.
 */
export async function executeCheckoutFlow(options: PayButtonOptions) {
  const { user, profile, items, totals, useBalance, rates, globalFees, promotions, orgsData } = options;

  if (!user) throw new Error("Usuário não identificado.");
  if (!items || items.length === 0) throw new Error("O carrinho está vazio.");

  const currenciesInCart = new Set(items.map(i => i.currency || 'BRL'));
  if (currenciesInCart.size > 1) {
    throw new Error("Não é possível realizar checkout com múltiplas moedas.");
  }

  // 1. Validação de Disponibilidade e Lock de Grátis
  for (const item of items) {
    const isExp = item.productType === 'experience';
    const collName = isExp ? "experiences" : "events";
    
    const eSnap = await getDoc(doc(staticDb, collName, item.eventId));
    if (!eSnap.exists()) throw new Error(`O item ${item.eventTitle} não está mais disponível.`);
    
    const event = eSnap.data();
    let batchSource = event.batches || [];

    if (item.occurrenceId) {
      const occSnap = await getDoc(doc(staticDb, isExp ? "experiences" : "recurring_occurrences", item.occurrenceId));
      if (occSnap.exists()) {
        const occData = occSnap.data();
        if (occData.batches && occData.batches.length > 0) batchSource = occData.batches;
      }
    }

    const batch = batchSource.find((b: any) => b.id === item.batchId);
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

  // 2. Fluxo de Ingressos Gratuitos
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

  // 3. Preparar Ordem de Pagamento com Snapshots de Taxas
  const exchangeRateToBRL = eventCurrency === 'BRL' ? 1 : (1 / (rates?.[eventCurrency] || 1));
  const exchangeDate = new Date().toISOString().slice(0, 10);

  const orderItems = items.map(item => {
    // RESOLUÇÃO DE TAXAS COM HIERARQUIA COMPLETA E TIPAGEM DE PRODUTO
    const breakdown = calculateFinancialBreakdown(
      item.price, 
      globalFees, 
      promotions, 
      orgsData[item.organizationId], 
      eventCurrency, 
      rates,
      item.productType as ProductType || 'event'
    );
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

  // Reserva de saldo se houver
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

  let balanceToSubtractCents = toCents(totals.balanceUsed);
  let totalApplicationFeeCents = 0;

  // 4. Mapeamento para o Stripe (Direct Split via Connect)
  const stripeLineItems = items.map((item) => {
    const split = calculateVibyOfficialSplit(
      item.price, 
      eventCurrency, 
      rates, 
      orgsData[item.organizationId], 
      globalFees, 
      promotions,
      item.productType as ProductType || 'event'
    );
    totalApplicationFeeCents += toCents(split.vibyApplicationFee) * item.quantity;
    
    let unitAmountCents = toCents(split.totalCharged);
    
    // Abatimento proporcional de saldo da carteira na linha do Stripe
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
      padding: item.productType === 'experience' ? 'experience_tag' : undefined,
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
