'use server';

import { headers } from 'next/headers';
import Stripe from 'stripe';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

async function getStripeKeys() {
  try {
    const app = getApps().find(a => a.name === "[DEFAULT]") || initializeApp(firebaseConfig);
    const db = getFirestore(app, 'eventosviby');
    const stripeDoc = await getDoc(doc(db, 'settings', 'stripe'));
    if (!stripeDoc.exists()) return { publishableKey: null, secretKey: null };
    const data = stripeDoc.data();
    return { publishableKey: data.publishableKey || null, secretKey: data.secretKey || null };
  } catch (e) {
    return { publishableKey: null, secretKey: null };
  }
}

async function getStripeInstance() {
  const { secretKey } = await getStripeKeys();
  if (!secretKey) throw new Error('Stripe não configurado no Painel Admin.');
  return new Stripe(secretKey, { typescript: true });
}

export async function createCheckoutSession(data: any) {
  try {
    const origin = (await headers()).get('origin') || 'https://viby.club';
    const stripe = await getStripeInstance();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: data.lineItems || [{
        price_data: {
          currency: 'brl',
          product_data: { name: data.eventTitle || 'Ingresso Viby' },
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
    throw new Error(error.message || 'Erro ao gerar sessão de pagamento.');
  }
}

export async function createAdBalanceTopUpSession(data: any) {
  try {
    const origin = (await headers()).get('origin') || 'https://viby.club';
    const stripe = await getStripeInstance();
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
      metadata: { type: 'ad_balance_topup', orgId: data.orgId, baseAmount: data.baseAmount.toString(), transactionId: data.transactionId },
    });
    return { url: session.url };
  } catch (error: any) {
    console.error("Stripe TopUp Error:", error);
    throw new Error(error.message || 'Erro ao processar recarga no Stripe.');
  }
}

export async function createPlanUpgradeSession(data: any) {
  try {
    const origin = (await headers()).get('origin') || 'https://viby.club';
    const stripe = await getStripeInstance();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { name: `Viby ${data.planName}` },
          unit_amount: Math.round(data.totalAmount),
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: data.userEmail,
      success_url: `${origin}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelado`,
      metadata: { type: 'plan_upgrade', userId: data.userId, plan: data.planId, cycle: data.billingCycle },
    });
    return { url: session.url };
  } catch (error: any) {
    throw new Error(error.message || 'Erro ao gerar checkout do plano');
  }
}

export async function createAdPaymentSession(data: any) {
  try {
    const origin = (await headers()).get('origin') || 'https://viby.club';
    const stripe = await getStripeInstance();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { name: `Impulsionamento: ${data.eventTitle}` },
          unit_amount: Math.round(data.totalAmount),
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: data.userEmail,
      success_url: `${origin}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelado`,
      metadata: { type: 'ad_payment', adId: data.adId, userId: data.userId },
    });
    return { url: session.url };
  } catch (error: any) {
    throw new Error(error.message || 'Erro ao gerar checkout do anúncio');
  }
}

export async function getStripeSession(sessionId: string) {
  try {
    const stripe = await getStripeInstance();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return { id: session.id, payment_status: session.payment_status, amount_total: session.amount_total, metadata: session.metadata };
  } catch (error) {
    return null;
  }
}
