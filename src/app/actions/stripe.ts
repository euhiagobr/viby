
'use server';

import { headers } from 'next/headers';
import Stripe from 'stripe';

/**
 * @fileOverview Server Actions para integração com Stripe.
 * Utiliza variáveis de ambiente para segurança e performance no servidor.
 */

function getStripeInstance() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY não configurada no ambiente (.env).');
  }
  return new Stripe(secretKey);
}

export async function createCheckoutSession(data: any) {
  try {
    const origin = (await headers()).get('origin') || 'https://viby.club';
    const stripe = getStripeInstance();
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: data.lineItems || [{
        price_data: {
          currency: 'brl',
          product_data: { 
            name: data.eventTitle || 'Ingresso Viby',
            images: data.eventImage ? [data.eventImage] : []
          },
          unit_amount: Math.round(data.totalAmount),
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: data.userEmail,
      success_url: `${origin}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelado`,
      metadata: data.metadata,
    });
    
    return { url: session.url };
  } catch (error: any) {
    console.error("[Stripe Action] Checkout Error:", error);
    throw new Error(error.message || 'Erro ao gerar sessão de pagamento.');
  }
}

export async function createAdBalanceTopUpSession(data: any) {
  try {
    const origin = (await headers()).get('origin') || 'https://viby.club';
    const stripe = getStripeInstance();
    const totalToCharge = data.baseAmount * 1.21;
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { name: `Recarga Ads - ${data.orgName}` },
          unit_amount: Math.round(totalToCharge * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: data.userEmail,
      success_url: `${origin}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelado`,
      metadata: { 
        type: 'ad_balance_topup', 
        orgId: data.orgId, 
        baseAmount: data.baseAmount.toString(), 
        transactionId: data.transactionId 
      },
    });
    
    return { url: session.url };
  } catch (error: any) {
    console.error("[Stripe Action] TopUp Error:", error);
    throw new Error(error.message || 'Erro ao processar recarga no Stripe.');
  }
}

export async function getStripeSession(sessionId: string) {
  try {
    const stripe = getStripeInstance();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return { 
      id: session.id, 
      payment_status: session.payment_status, 
      amount_total: session.amount_total, 
      metadata: session.metadata 
    };
  } catch (error) {
    console.error("[Stripe Action] Retrieve Session Error:", error);
    return null;
  }
}
