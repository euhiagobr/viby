'use server';

import { headers } from 'next/headers';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { logSystemError } from '@/lib/error-manager';
import { calculateVibyOfficialSplit, toCents, ProductType } from '@/lib/financial-utils';

async function getStripeInstance(db: admin.firestore.Firestore) {
  const snap = await db.collection('settings').doc('stripe').get();
  const data = snap.data();
  if (!data?.secretKey) throw new Error("Stripe Secret Key not found.");
  return new Stripe(data.secretKey, { apiVersion: '2024-12-18.acacia' as any });
}

export async function createCheckoutSession(data: any) {
  const db = getAdminDb();
  
  try {
    const head = await headers();
    const origin = head.get('origin') || 'https://viby.club';
    const stripe = await getStripeInstance(db);

    const { metadata, userEmail, lineItems, destinationStripeAccount, currency = 'brl' } = data;
    const orderId = metadata?.orderId;

    if (!orderId) throw new Error("ID do pedido é obrigatório para o checkout.");

    const [orderSnap, globalFeesSnap, promotionsSnap, ratesSnap] = await Promise.all([
      db.collection("orders").doc(orderId).get(),
      db.collection("settings").doc("fees").get(),
      db.collection("settings").doc("promotions").get(),
      db.collection("settings").doc("currency_rates").get()
    ]);

    if (!orderSnap.exists) throw new Error("Pedido não localizado.");
    const orderData = orderSnap.data()!;
    const globalFees = globalFeesSnap.data();
    const promotions = promotionsSnap.data();
    const rates = ratesSnap.data() || { BRL: 1, USD: 0.18, EUR: 0.16 };

    let totalApplicationFeeCents = 0;
    const orgCache: Record<string, any> = {};

    for (const item of orderData.items || []) {
      if (!orgCache[item.organizationId]) {
        const orgSnap = await db.collection("organizations").doc(item.organizationId).get();
        orgCache[item.organizationId] = orgSnap.exists ? orgSnap.data() : {};
      }

      const split = calculateVibyOfficialSplit(
        item.price, 
        (orderData.currency || 'BRL') as any, 
        rates, 
        orgCache[item.organizationId], 
        globalFees, 
        promotions,
        item.productType as ProductType || 'event'
      );

      totalApplicationFeeCents += toCents(split.vibyApplicationFee) * item.quantity;
    }

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: lineItems, 
      mode: 'payment',
      customer_email: userEmail,
      success_url: `${origin}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelado`,
      metadata: {
        ...metadata,
        server_verified: 'true'
      },
      payment_intent_data: {
        application_fee_amount: totalApplicationFeeCents,
        transfer_data: {
          destination: destinationStripeAccount,
        },
        statement_descriptor: 'VIBY*PAY',
      }
    };

    const session = await stripe.checkout.sessions.create(sessionConfig);
    return { success: true, url: session.url };
  } catch (error: any) {
    console.error("[Stripe Session Server] Critical Error:", error.message);
    
    await logSystemError({
      error: { message: error.message, stack: error.stack },
      type: 'stripe_checkout_server_failure',
      severity: 'critical',
      metadata: { orderId: data.metadata?.orderId }
    });

    let userMessage = error.message;
    if (error.message.includes('No such destination')) {
       userMessage = "O organizador deste item possui um problema na conta de recebimento. Por favor, tente novamente mais tarde.";
    }

    return { success: false, error: userMessage };
  }
}

export async function createAdBalanceTopUpSession(data: any) {
  const db = getAdminDb();
  try {
    const head = await headers();
    const origin = head.get('origin') || 'https://viby.club';
    const stripe = await getStripeInstance(db);

    const { orgId, orgUsername, userEmail, baseAmount, totalToPay, couponCode, transactionId } = data;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: 'Recarga Saldo Viby Ads',
              description: `Marca: @${orgUsername}`,
            },
            unit_amount: Math.round(totalToPay * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: userEmail,
      success_url: `${origin}/dashboard/organizacoes/${orgUsername}/finance?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/organizacoes/${orgUsername}/finance?canceled=true`,
      metadata: {
        type: 'ad_topup',
        orgId,
        transactionId,
        baseAmount: baseAmount.toString(),
        totalToPay: totalToPay.toString(),
        couponCode: couponCode || ''
      },
    });

    return { success: true, url: session.url };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function finalizeAdTopUpSession(sessionId: string) {
  return { success: true };
}

export async function finalizeCheckoutSession(sessionId: string) {
  return { success: true };
}
