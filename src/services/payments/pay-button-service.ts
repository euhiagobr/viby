'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from "@/lib/firebase/admin";
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
 * Executa o fluxo de checkout utilizando o Admin SDK para máxima estabilidade e segurança.
 * CORREÇÃO CRÍTICA: Todas as operações de leitura (get) agora ocorrem antes das escritas.
 */
export async function executeCheckoutFlow(options: PayButtonOptions) {
  const { user, profile, items, totals, useBalance, rates, globalFees, promotions, coupon } = options;
  const db = getAdminDb();

  if (!user) throw new Error("Usuário não identificado.");
  if (!items || items.length === 0) throw new Error("O carrinho está vazio.");

  const currenciesInCart = new Set(items.map(i => i.currency || 'BRL'));
  if (currenciesInCart.size > 1) {
    throw new Error("Não é possível realizar checkout com múltiplas moedas.");
  }

  const eventCurrency = (items[0]?.currency || 'BRL') as CurrencyCode;

  // --- BLOCO DE LEITURA (READS FIRST) ---
  
  // 1. Validar Organizações e Coletar Stripe IDs
  const orgIds = Array.from(new Set(items.map(i => i.organizationId)));
  const orgsSnapMap: Record<string, any> = {};
  for (const orgId of orgIds) {
    const oSnap = await db.collection("organizations").doc(orgId).get();
    if (!oSnap.exists) throw new Error("Uma das organizações parceiras não foi localizada.");
    orgsSnapMap[orgId] = oSnap.data();
  }

  // 2. Verificar Disponibilidade dos Eventos e Travas de Ingressos Gratuitos
  for (const item of items) {
    const isExp = item.productType === 'experience';
    const collName = isExp ? "experiences" : "events";
    const eSnap = await db.collection(collName).doc(item.eventId).get();
    if (!eSnap.exists) throw new Error(`O item ${item.eventTitle} não está mais disponível.`);
    
    if (item.price === 0 && !isExp) {
      const lockId = `free_lock_${user.id || user.uid}_${item.eventId}_${item.ticketTypeId}`;
      const lockSnap = await db.collection("registrations_locks").doc(lockId).get();
      if (lockSnap.exists) throw new Error("Você já resgatou este ingresso gratuito.");
    }
  }

  // 3. Verificar Saldo da Carteira (Se aplicável)
  if (useBalance && totals.balanceUsed > 0 && eventCurrency === 'BRL') {
    const walletSnap = await db.collection("wallets").doc(user.id || user.uid).get();
    if (!walletSnap.exists || (walletSnap.data()?.balance || 0) < totals.balanceUsed) {
      throw new Error("Saldo insuficiente na carteira.");
    }
  }

  // --- BLOCO DE ESCRITA (WRITES START HERE) ---

  // 4. Fluxo de Itens Gratuitos (Pulo do Stripe)
  if (Number(totals.total) <= 0) {
    for (const item of items) {
      if (item.productType === 'experience' && item.occurrenceId) {
        const res = await createExperienceReservationAction({
          experienceId: item.eventId,
          slotId: item.occurrenceId,
          userId: user.id || user.uid,
          quantity: item.quantity
        });
        if (!res.success) throw new Error(res.error || "Falha ao reservar vaga na experiência.");
      }
    }

    const result = await generateFreeTickets({
      userId: user.id || user.uid,
      userName: profile?.name || user.displayName || "Comprador",
      userEmail: user.email!,
      items: items.map(item => ({
        ...item,
        price: 0,
        discountAmount: item.price,
        couponCode: coupon?.code
      }))
    });

    if (!result.success) throw new Error(result.error);
    return { type: 'free', success: true };
  }

  // 5. Fluxo de Pagamento Real (Stripe)
  const reservationIds: string[] = [];
  for (const item of items) {
    if (item.productType === 'experience' && item.occurrenceId) {
      const res = await createExperienceReservationAction({
        experienceId: item.eventId,
        slotId: item.occurrenceId,
        userId: user.id || user.uid,
        quantity: item.quantity
      });

      if (!res.success) throw new Error(res.error || "Não foi possível reservar este horário.");
      reservationIds.push(res.reservationId);
    }
  }

  // Preparar Snapshot de Itens para a Ordem
  const orderItems = items.flatMap(item => {
    const productType = (item.productType as ProductType) || 'event';
    const org = orgsSnapMap[item.organizationId];

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
    userId: user.id || user.uid,
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
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (useBalance && totals.balanceUsed > 0 && eventCurrency === 'BRL') {
    await db.collection("wallets").doc(user.id || user.uid).update({
      balance: admin.firestore.FieldValue.increment(-totals.balanceUsed),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  const orderRef = await db.collection("orders").add(orderData);

  let balanceToSubtractCents = toCents(totals.balanceUsed);
  let totalApplicationFeeCents = 0;

  const stripeLineItems = orderItems.map((item) => {
    const resolvedProductType = (item.productType as ProductType) || 'event';
    const split = calculateVibyOfficialSplit(item.price, eventCurrency, rates, orgsSnapMap[item.organizationId], globalFees, promotions, resolvedProductType);
    
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

  const stripeAccountId = orgsSnapMap[items[0].organizationId]?.stripeAccountId;
  if (!stripeAccountId) throw new Error("O organizador não possui conta de recebimento configurada no Stripe.");

  const stripeResult = await createCheckoutSession({
    userEmail: user.email!,
    lineItems: stripeLineItems,
    currency: eventCurrency.toLowerCase(),
    totalApplicationFeeCents,
    destinationStripeAccount: stripeAccountId,
    metadata: {
      type: "order_checkout",
      orderId: orderRef.id,
      userId: user.id || user.uid,
      balanceUsed: totals.balanceUsed.toString(),
      reservations: reservationIds.join(',')
    }
  });

  if (!stripeResult.success) {
    await orderRef.update({ status: 'failed', error: stripeResult.error });
    throw new Error(stripeResult.error);
  }

  return { type: 'stripe', url: stripeResult.url };
}