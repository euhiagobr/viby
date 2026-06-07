'use server';

import { headers } from 'next/headers';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { logSystemError } from '@/lib/error-manager';

async function getStripeInstance(db: admin.firestore.Firestore) {
  const snap = await db.collection('settings').doc('stripe').get();
  if (!snap.exists) throw new Error('Configurações do Stripe não localizadas.');
  const data = snap.data();
  const secretKey = data?.secretKey?.trim();
  if (!secretKey) throw new Error('Secret Key do Stripe ausente.');
  return new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' as any });
}

export async function createCheckoutSession(data: any) {
  try {
    const db = getAdminDb();
    const head = await headers();
    const origin = head.get('origin') || 'https://viby.club';
    const stripe = await getStripeInstance(db);

    const { metadata, userEmail, lineItems, totalApplicationFeeCents, destinationStripeAccount, currency = 'brl' } = data;

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: userEmail,
      success_url: `${origin}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelado`,
      metadata: metadata,
    };

    if (destinationStripeAccount) {
      sessionConfig.payment_intent_data = {
        application_fee_amount: totalApplicationFeeCents,
        transfer_data: {
          destination: destinationStripeAccount,
        },
        statement_descriptor: 'VIBY*INGRESSOS',
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    return { success: true, url: session.url };
  } catch (error: any) {
    // Log detalhado para o ErrorManager
    await logSystemError({
      error: { message: error.message, stack: error.stack },
      type: 'stripe_checkout_failure',
      severity: 'error',
      metadata: { 
        orderId: data.metadata?.orderId,
        destination: data.destinationStripeAccount,
        errorCode: error.code,
        errorType: error.type
      }
    });

    // Mensagem amigável para o usuário final
    let userMessage = error.message;
    if (error.message.includes('No such destination')) {
       userMessage = "O organizador deste evento possui um problema na conta de recebimento. Por favor, tente novamente mais tarde.";
    }

    return { success: false, error: userMessage };
  }
}

export async function finalizeCheckoutSession(sessionId: string) {
  return { success: true };
}

/**
 * Cria uma sessão de checkout para recarga de saldo de anúncios de uma marca.
 */
export async function createAdBalanceTopUpSession(data: any) {
  try {
    const db = getAdminDb();
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
    console.error("[Stripe Ads TopUp Error]", error);
    return { success: false, error: error.message };
  }
}

export async function finalizeAdTopUpSession(sessionId: string) {
  // O processamento real é feito via Webhook, esta função serve como gatilho de UI.
  return { success: true };
}
