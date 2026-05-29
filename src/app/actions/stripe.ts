
'use client';

import { headers } from 'next/headers';
import Stripe from 'stripe';
import { db } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * @fileOverview Server Actions para integração com Stripe.
 * Busca as chaves dinamicamente do Firestore (Client SDK) para permitir configuração via painel Admin.
 */

async function getStripeInstance() {
  const snap = await getDoc(doc(db, 'settings', 'stripe'));
  
  if (!snap.exists() || !snap.data()?.secretKey) {
    throw new Error('Stripe não configurado. Vá em Painel Admin > Configurações > Pagamentos.');
  }
  
  return new Stripe(snap.data()?.secretKey);
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
    const stripe = await getStripeInstance();
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
