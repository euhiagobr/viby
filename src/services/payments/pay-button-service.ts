
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
  const orderItems = items.map(item => {
    const productType = (item.productType as ProductType) || 'event';
    const org = orgsSnapMap[item.organizationId];

    let discValPerUnit = 0;
    const couponVal = Number(coupon?.discountValue) || 0;

    // A aplicação do cupom deve ser por unidade (ticket)
    if (coupon && coupon.eventId === item.eventId) {
      if (coupon.discountType === 'percentage') {
        discValPerUnit = Number((item.price * (couponVal / 100)).toFixed(2));
      } else if (coupon.discountType === 'fixed') {
        // Desconto fixo por unidade
        discValPerUnit = Math.min(item.price, couponVal);
      } else if (coupon.discountType === 'free_ticket') {
        discValPerUnit = item.price;
      }
    }

    const discountedPricePerUnit = Math.max(0, item.price - discValPerUnit);
    const breakdown = calculateFinancialBreakdown(discountedPricePerUnit, globalFees, promotions, org, eventCurrency, rates, productType);

    return {
      ...item,
      price: discountedPricePerUnit,
      originalPrice: item.price,
      discountAmount: discValPerUnit, // Este campo agora representa o desconto por UNIDADE
      couponCode: coupon?.code || null,
      userCouponId: coupon?.isUserCoupon ? coupon.id : null,
      producerNetAmount: breakdown.producerNetAmount,
      administrativeFeeAmount: breakdown.administrativeFeeAmount,
      financials: breakdown
    };
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
      items: orderItems
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
      // O preço unitário enviado ao Stripe já contempla o desconto e a taxa Viby
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
