'use server';

import { headers } from 'next/headers';
import Stripe from 'stripe';
import { getAdminDb } from '@/lib/firebase/admin';

/**
 * @fileOverview Server Actions para integração dinâmica com Stripe.
 * Busca a Secret Key diretamente do Firestore (banco eventosviby) em cada requisição.
 * PROIBIDO o uso de process.env para chaves Stripe.
 */

async function getStripeInstance() {
  try {
    const db = getAdminDb();
    const snap = await db.collection('settings').doc('stripe').get();
    const data = snap.data();
    
    if (!snap.exists || !data?.secretKey) {
      console.error("[Stripe Action] Configuração ausente em settings/stripe");
      throw new Error('Configuração Stripe não encontrada no painel administrativo.');
    }
    
    // Inicializa Stripe dinamicamente com a chave salva no banco
    return new Stripe(data.secretKey, {
      appInfo: {
        name: 'Viby Club',
        version: '2.1.0'
      }
    });
  } catch (e: any) {
    console.error("[Stripe Action] Erro ao instanciar Stripe:", e.message);
    throw new Error('Erro ao inicializar o gateway de pagamento. Verifique as chaves no Admin.');
  }
}

export async function createCheckoutSession(data: any) {
  try {
    const head = await headers();
    const origin = head.get('origin') || 'https://viby.club';
    const stripe = await getStripeInstance();
    
    // Busca e-mail do usuário se não fornecido
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
    
    return { url: session.url };
  } catch (error: any) {
    console.error("[Stripe Checkout Error]:", error.message);
    throw new Error(error.message || 'Erro ao gerar sessão de pagamento.');
  }
}

export async function createAdBalanceTopUpSession(data: any) {
  try {
    const head = await headers();
    const origin = head.get('origin') || 'https://viby.club';
    const stripe = await getStripeInstance();
    
    // Taxa de recarga de ads fixada em 21% conforme lógica atual
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
    console.error("[Stripe Ad TopUp Error]:", error.message);
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
    console.error("[Stripe Session Retrieval Error]:", sessionId);
    return null;
  }
}
