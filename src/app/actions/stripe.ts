'use server';

import { headers } from 'next/headers';
import Stripe from 'stripe';
import { db } from '@/firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { logSystemError } from '@/lib/error-manager';

/**
 * @fileOverview Server Actions do Stripe com inicialização dinâmica e segura.
 */

async function getStripeInstance() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'stripe'));
    
    if (!snap.exists()) {
      throw new Error('Configurações do Stripe não localizadas no banco.');
    }

    const data = snap.data();
    const secretKey = data?.secretKey?.trim();

    if (!secretKey) throw new Error('Secret Key do Stripe ausente.');

    return new Stripe(secretKey, {
      apiVersion: '2024-12-18.acacia' as any,
    });
  } catch (e: any) {
    console.error("[Stripe Init Error]", e.message);
    throw e;
  }
}

export async function createCheckoutSession(data: any) {
  try {
    const head = await headers();
    const origin = head.get('origin') || 'https://viby.club';
    
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
    
    return { success: true, url: session.url };
  } catch (error: any) {
    const errorCode = await logSystemError({
      error,
      type: 'stripe_checkout_failure',
      severity: 'error',
      metadata: { items: data.metadata?.registrationIds }
    });
    return { success: false, error: error.message, code: errorCode };
  }
}

export async function createAdBalanceTopUpSession(data: any) {
  try {
    const head = await headers();
    const origin = head.get('origin') || 'https://viby.club';
    const stripe = await getStripeInstance();
    
    const amountToCharge = data.baseAmount * 1.21;
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { 
            name: `Recarga Ads - ${data.orgName}`,
            description: `Crédito de R$ ${data.baseAmount} + Encargos Fiscais (21%)`
          },
          unit_amount: Math.round(amountToCharge * 100),
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
    
    return { success: true, url: session.url };
  } catch (error: any) {
    return { success: false, error: error.message };
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
  } catch (error: any) {
    return null;
  }
}
