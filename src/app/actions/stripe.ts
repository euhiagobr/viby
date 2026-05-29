
'use server';

import { headers } from 'next/headers';
import Stripe from 'stripe';
import { getAdminDb } from '@/lib/firebase/admin';
import { logSystemError } from '@/lib/error-manager';

/**
 * @fileOverview Serviço dinâmico do Stripe (Server-Side).
 * Busca as chaves do Firestore em tempo real. Sem dependência de .env.
 */

async function getStripeInstance() {
  try {
    const db = getAdminDb();
    const snap = await db.collection('settings').doc('stripe').get();
    
    if (!snap.exists) {
      throw new Error('Configurações do Stripe não localizadas.');
    }

    const data = snap.data();
    const secretKey = data?.secretKey?.trim();

    if (!secretKey) {
      throw new Error('Secret Key do Stripe ausente.');
    }

    return new Stripe(secretKey, {
      apiVersion: '2024-12-18.acacia' as any,
      appInfo: {
        name: 'Viby Club',
        version: '3.0.0'
      }
    });
  } catch (e: any) {
    await logSystemError({
      error: e,
      type: 'stripe_init_failure',
      severity: 'critical'
    });
    throw new Error(e.message || 'Falha na inicialização do gateway.');
  }
}

export async function createCheckoutSession(data: any) {
  try {
    const head = await headers();
    const origin = head.get('origin') || 'https://viby.club';
    
    const stripe = await getStripeInstance();
    const userEmail = data.userEmail || "comprador@viby.club";
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: data.lineItems || [{
        price_data: {
          currency: 'brl',
          product_data: { 
            name: data.eventTitle || 'Ingresso Viby',
            images: (data.eventImage && data.eventImage.startsWith('http')) ? [data.eventImage] : []
          },
          unit_amount: Math.round(data.totalAmount),
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: userEmail,
      success_url: `${origin}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelado`,
      metadata: data.metadata,
    });
    
    if (!session.url) {
      throw new Error("Stripe não retornou URL válida.");
    }

    return { url: session.url };
  } catch (error: any) {
    await logSystemError({
      error,
      type: 'stripe_checkout_error',
      severity: 'error',
      metadata: { checkoutData: data }
    });
    return { success: false, error: error.message };
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
    
    return { url: session.url };
  } catch (error: any) {
    await logSystemError({
      error,
      type: 'stripe_ad_topup_error',
      severity: 'error',
      metadata: { topupData: data }
    });
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
    await logSystemError({
      error,
      type: 'stripe_session_retrieval_error',
      severity: 'warning',
      metadata: { sessionId }
    });
    return null;
  }
}
