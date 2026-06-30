'use server';

import { 
  doc, 
  collection, 
  addDoc, 
  updateDoc, 
  getDoc,
  serverTimestamp,
  increment
} from "firebase/firestore";
import { db as staticDb } from "@/firebase/database";
import { createCheckoutSession } from "@/app/actions/stripe";
import { generateFreeTickets } from "@/app/actions/tickets";
import { calculateVibyOfficialSplit, toCents, calculateFinancialBreakdown, ProductType } from "@/lib/financial-utils";
import { CartItem } from "@/contexts/CartContext";
import { CurrencyCode } from "@/contexts/CurrencyContext";
import { createExperienceReservationAction } from "@/app/actions/experiences";

export interface PayButtonOptions {
  user: any;
  profile: any;
  items: CartItem[];
  totals: any;
  globalFees: any;
  promotions: any;
  orgsData: Record<string, any>;
  useBalance: boolean;
  rates: Record<string, number>;
  coupon?: any;
}

/**
 * Executa o fluxo de checkout garantindo a injeção correta da hierarquia de taxas.
 * Corrigido para garantir que todas as leituras (getDoc) ocorram antes das escritas.
 * Se o total "virar" zero (via cupom), ignora o Stripe e processa internamente.
 */
export async function executeCheckoutFlow(options: PayButtonOptions) {
  const { user, profile, items, totals, useBalance, rates, globalFees, promotions, orgsData, coupon } = options;

  if (!user) throw new Error("Usuário não identificado.");
  if (!items || items.length === 0) throw new Error("O carrinho está vazio.");

  const currenciesInCart = new Set(items.map(i => i.currency || 'BRL'));
  if (currenciesInCart.size > 1) {
    throw new Error("Não é possível realizar checkout com múltiplas moedas.");
  }

  const eventCurrency = (items[0]?.currency || 'BRL') as CurrencyCode;

  // 1. BLOCO DE LEITURA (VALIDAÇÕES INICIAIS)
  // Realizamos todas as leituras antes de qualquer escrita para evitar erro do Firestore
  for (const item of items) {
    const isExp = item.productType === 'experience';
    const collName = isExp ? "experiences" : "events";
    
    const eSnap = await getDoc(doc(staticDb, collName, item.eventId));
    if (!eSnap.exists()) throw new Error(`O item ${item.eventTitle} não está mais disponível.`);
    
    if (item.price === 0 && !isExp) {
      const lockId = `free_lock_${user.uid}_${item.eventId}_${item.ticketTypeId}`;
      const lockSnap = await getDoc(doc(staticDb, "registrations_locks", lockId));
      if (lockSnap.exists()) throw new Error("Você já resgatou este ingresso gratuito.");
    }
  }

  if (useBalance && totals.balanceUsed > 0 && eventCurrency === 'BRL') {
    const walletRef = doc(staticDb, "wallets", user.uid);
    const wSnap = await getDoc(walletRef);
    if (!wSnap.exists() || (wSnap.data().balance || 0) < totals.balanceUsed) {
      throw new Error("Saldo insuficiente na carteira.");
    }
  }

  // 2. VERIFICAÇÃO DE TOTAL ZERO (PULO DO STRIPE)
  // Se o total é zero (seja por preço base ou cupom de 100%), processamos via fluxo interno
  if (Number(totals.total) <= 0) {
    // Se houver experiências, precisamos reservar o slot antes de gerar o ticket
    for (const item of items) {
      if (item.productType === 'experience' && item.occurrenceId) {
        const res = await createExperienceReservationAction({
          experienceId: item.eventId,
          slotId: item.occurrenceId,
          userId: user.uid,
          quantity: item.quantity
        });
        if (!res.success) throw new Error(res.error || "Falha ao reservar vaga.");
      }
    }

    const result = await generateFreeTickets({
      userId: user.uid,
      userName: profile?.name || user.displayName || "Comprador",
      userEmail: user.email!,
      items: items.map(item => ({
        ...item,
        price: 0, // Força preço 0 para o gerador interno
        discountAmount: item.price,
        couponCode: coupon?.code
      }))
    });

    if (!result.success) throw new Error(result.error);
    return { type: 'free', success: true };
  }

  // 3. FLUXO PAGO (STRIPE)
  const reservationIds: string[] = [];
  for (const item of items) {
    if (item.productType === 'experience' && item.occurrenceId) {
      const res = await createExperienceReservationAction({
        experienceId: item.eventId,
        slotId: item.occurrenceId,
        userId: user.uid,
        quantity: item.quantity
      });

      if (!res.success) {
        throw new Error(res.error || "Não foi possível reservar este horário.");
      }
      reservationIds.push(res.reservationId);
    }
  }

  // Preparar itens da ordem com snapshots financeiros
  const orderItems = items.flatMap(item => {
    const productType = (item.productType as ProductType) || 'event';
    const org = orgsData[item.organizationId];

    if (coupon && coupon.eventId === item.eventId) {
      let discVal = 0;
      if (coupon.discountType === 'percentage') {
        discVal = Number((item.price * (coupon.discountValue / 100)).toFixed(2));
      } else if (coupon.discountType === 'fixed') {
        discVal = Math.min(item.price, coupon.discountValue);
      } else if (coupon.discountType === 'free_ticket') {
        discVal = item.price;
      }

      const discountedPrice = Math.max(0, item.price - discVal);
      const breakdownDiscounted = calculateFinancialBreakdown(discountedPrice, globalFees, promotions, org, eventCurrency, rates, productType);
      const breakdownFull = calculateFinancialBreakdown(item.price, globalFees, promotions, org, eventCurrency, rates, productType);

      const splitItems = [];
      splitItems.push({
        ...item,
        id: `${item.id}_disc`,
        quantity: 1,
        price: discountedPrice,
        originalPrice: item.price,
        discountAmount: discVal,
        couponCode: coupon.code,
        producerNetAmount: breakdownDiscounted.producerNetAmount,
        administrativeFeeAmount: breakdownDiscounted.administrativeFeeAmount,
        financials: breakdownDiscounted
      });

      if (item.quantity > 1) {
        splitItems.push({
          ...item,
          id: `${item.id}_full`,
          quantity: item.quantity - 1,
          price: item.price,
          originalPrice: item.price,
          discountAmount: 0,
          producerNetAmount: breakdownFull.producerNetAmount,
          administrativeFeeAmount: breakdownFull.administrativeFeeAmount,
          financials: breakdownFull
        });
      }
      return splitItems;
    }

    const breakdown = calculateFinancialBreakdown(item.price, globalFees, promotions, org, eventCurrency, rates, productType);
    return [{
      ...item,
      producerNetAmount: breakdown.producerNetAmount,
      administrativeFeeAmount: breakdown.administrativeFeeAmount,
      financials: breakdown 
    }];
  });

  const orderData = {
    userId: user.uid,
    userEmail: user.email,
    userName: profile?.name || user.displayName || "Comprador",
    items: orderItems,
    currency: eventCurrency,
    experienceReservations: reservationIds,
    totals: {
      subtotal: totals.subtotal,
      fees: totals.fees,
      discount: totals.discount,
      balanceUsed: totals.balanceUsed,
      totalToPay: totals.total
    },
    status: 'pending',
    createdAt: serverTimestamp()
  };

  // Deduzir saldo da carteira se estiver em BRL
  if (useBalance && totals.balanceUsed > 0 && eventCurrency === 'BRL') {
    await updateDoc(doc(staticDb, "wallets", user.uid), {
      balance: increment(-totals.balanceUsed),
      updatedAt: serverTimestamp()
    });
  }

  const orderRef = await addDoc(collection(staticDb, "orders"), orderData);

  // Mapear para Stripe Connect
  let balanceToSubtractCents = toCents(totals.balanceUsed);
  let totalApplicationFeeCents = 0;

  const stripeLineItems = orderItems.map((item) => {
    const resolvedProductType = (item.productType as ProductType) || 'event';
    const split = calculateVibyOfficialSplit(item.price, eventCurrency, rates, orgsData[item.organizationId], globalFees, promotions, resolvedProductType);
    
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
          description: `Voucher: ${item.batchName} ${item.couponCode ? `(Cupom: ${item.couponCode})` : ""}`,
          images: item.eventImage ? [item.eventImage] : []
        },
        unit_amount: unitAmountCents,
      },
      quantity: item.quantity,
    };
  });

  const orgDoc = await getDoc(doc(staticDb, "organizations", items[0].organizationId));
  const stripeAccountId = orgDoc.data()?.stripeAccountId;

  if (!stripeAccountId) throw new Error("O organizador não possui conta de recebimento configurada.");

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
      balanceUsed: totals.balanceUsed.toString(),
      reservations: reservationIds.join(',')
    }
  });

  if (!stripeResult.success) {
    await updateDoc(orderRef, { status: 'failed', error: stripeResult.error });
    throw new Error(stripeResult.error);
  }

  return { type: 'stripe', url: stripeResult.url };
}
