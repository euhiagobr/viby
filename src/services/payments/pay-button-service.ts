
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

export async function executeCheckoutFlow(options: PayButtonOptions) {
  const { user, profile, items, totals, useBalance, rates, globalFees, promotions, coupon } = options;
  const db = getAdminDb();

  if (!user) throw new Error("Usuário não identificado.");
  if (!items || items.length === 0) throw new Error("O carrinho está vazio.");

  const eventCurrency = (items[0]?.currency || 'BRL') as CurrencyCode;

  // 1. Validar Organizações e Coletar Stripe IDs
  const orgIds = Array.from(new Set(items.map(i => i.organizationId)));
  const orgsSnapMap: Record<string, any> = {};
  for (const orgId of orgIds) {
    const oSnap = await db.collection("organizations").doc(orgId).get();
    if (!oSnap.exists) throw new Error("Organização não localizada.");
    orgsSnapMap[orgId] = oSnap.data();
  }

  // 2. Fluxo de Pagamento Real (Stripe) ou Gratuito
  const reservationIds: string[] = [];
  for (const item of items) {
    if (item.productType === 'experience' && item.occurrenceId) {
      const res = await createExperienceReservationAction({
        experienceId: item.eventId,
        slotId: item.occurrenceId,
        userId: user.uid || user.id,
        quantity: item.quantity
      });
      if (!res.success) throw new Error(res.error || "Não foi possível reservar este horário.");
      reservationIds.push(res.reservationId);
    }
  }

  // Preparar Snapshot de Itens para a Ordem (Incluindo Cupons de Usuário)
  const orderItems = items.flatMap(item => {
    const productType = (item.productType as ProductType) || 'event';
    const org = orgsSnapMap[item.organizationId];

    let discVal = 0;
    const couponVal = Number(coupon?.discountValue) || 0;

    if (coupon && coupon.eventId === item.eventId) {
      if (coupon.discountType === 'percentage') {
        discVal = Number((item.price * (couponVal / 100)).toFixed(2));
      } else if (coupon.discountType === 'fixed') {
        discVal = Math.min(item.price, couponVal);
      } else if (coupon.discountType === 'free_ticket') {
        discVal = item.price;
      }
    }

    const discountedPrice = Math.max(0, item.price - discVal);
    const breakdownDiscounted = calculateFinancialBreakdown(discountedPrice, globalFees, promotions, org, eventCurrency, rates, productType);
    const breakdownFull = calculateFinancialBreakdown(item.price, globalFees, promotions, org, eventCurrency, rates, productType);

    const splitItems = [];
    // Unidade com desconto
    if (discVal > 0) {
      splitItems.push({
        ...item,
        id: `${item.id}_disc`,
        quantity: 1,
        price: discountedPrice,
        originalPrice: item.price,
        discountAmount: discVal,
        couponCode: coupon?.code,
        userCouponId: coupon?.isUserCoupon ? coupon.id : null,
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
          producerNetAmount: breakdownFull.producerNetAmount,
          administrativeFeeAmount: breakdownFull.administrativeFeeAmount,
          financials: breakdownFull
        });
      }
    } else {
      splitItems.push({
        ...item,
        producerNetAmount: breakdownFull.producerNetAmount,
        administrativeFeeAmount: breakdownFull.administrativeFeeAmount,
        financials: breakdownFull 
      });
    }
    
    return splitItems;
  });

  const orderData = {
    userId: user.uid || user.id,
    userEmail: user.email,
    userName: profile?.name || user.displayName || "Comprador",
    items: orderItems,
    currency: eventCurrency,
    couponCode: coupon?.code || null,
    userCouponId: coupon?.isUserCoupon ? coupon.id : null,
    totals: totals,
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const orderRef = await db.collection("orders").add(orderData);

  if (Number(totals.total) <= 0) {
    const result = await generateFreeTickets({
      userId: user.uid || user.id,
      userName: profile?.name || user.displayName || "Comprador",
      userEmail: user.email!,
      items: orderItems.map(i => ({ ...i, price: 0 }))
    });
    if (!result.success) throw new Error(result.error);
    return { type: 'free', success: true };
  }

  const stripeLineItems = orderItems.map((item) => ({
    price_data: {
      currency: eventCurrency.toLowerCase(),
      product_data: {
        name: `${item.eventTitle} - ${item.ticketTypeName}`,
        description: item.couponCode ? `Cupom: ${item.couponCode}` : "",
      },
      unit_amount: toCents(item.price + item.administrativeFeeAmount),
    },
    quantity: item.quantity,
  }));

  const stripeAccountId = orgsSnapMap[items[0].organizationId]?.stripeAccountId;
  if (!stripeAccountId) throw new Error("Organizador sem conta Stripe.");

  const stripeResult = await createCheckoutSession({
    userEmail: user.email!,
    lineItems: stripeLineItems,
    currency: eventCurrency.toLowerCase(),
    destinationStripeAccount: stripeAccountId,
    metadata: {
      type: "order_checkout",
      orderId: orderRef.id,
      userId: user.uid || user.id,
      userCouponId: coupon?.isUserCoupon ? coupon.id : ""
    }
  });

  return { type: 'stripe', url: stripeResult.url };
}
