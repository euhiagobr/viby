
'use server';

import { headers } from 'next/headers';
import Stripe from 'stripe';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

/**
 * Helper para obter as chaves do Stripe diretamente do Firestore.
 */
async function getStripeKeys() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const db = getFirestore(app, 'eventosviby');
  
  const stripeDoc = await getDoc(doc(db, 'settings', 'stripe'));
  if (!stripeDoc.exists()) {
    throw new Error('Configuração do Stripe não encontrada no painel administrativo.');
  }

  return {
    publishableKey: stripeDoc.data().publishableKey,
    secretKey: stripeDoc.data().secretKey,
  };
}

/**
 * Inicializa uma instância do Stripe com a Secret Key do banco.
 * Removido apiVersion explícito para evitar erros de compatibilidade.
 */
async function getStripeInstance() {
  const { secretKey } = await getStripeKeys();
  if (!secretKey) throw new Error('Stripe Secret Key não configurada no painel.');
  
  return new Stripe(secretKey, {
    typescript: true,
  });
}

export async function createCheckoutSession(data: {
  eventId: string;
  eventTitle: string;
  eventImage: string;
  userId: string;
  userName: string;
  userEmail: string;
  totalAmount: number; // Em centavos
  metadata: any;
}) {
  const origin = (await headers()).get('origin');

  try {
    const stripe = await getStripeInstance();

    // Converter metadados para string (exigência do Stripe)
    const sanitizedMetadata: Record<string, string> = {};
    Object.entries(data.metadata).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        sanitizedMetadata[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
      }
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: data.eventTitle,
              description: `Reserva de ingresso para ${data.eventTitle}`,
              images: data.eventImage ? [data.eventImage] : [],
            },
            unit_amount: Math.round(data.totalAmount),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: data.userEmail,
      success_url: `${origin}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelado`,
      metadata: sanitizedMetadata,
    });

    return { url: session.url };
  } catch (error: any) {
    console.error('Erro Stripe:', error);
    throw new Error(error.message || 'Erro ao processar pagamento');
  }
}

export async function createPlanCheckoutSession(data: {
  planName: string;
  planId: 'PRO' | 'TOP';
  billingCycle: 'monthly' | 'annual';
  userId: string;
  userEmail: string;
  totalAmount: number; // Em centavos
}) {
  const origin = (await headers()).get('origin');

  try {
    const stripe = await getStripeInstance();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `Viby ${data.planName}`,
              description: `Upgrade de conta para o plano ${data.planName} (${data.billingCycle === 'monthly' ? 'Mensal' : 'Anual'})`,
            },
            unit_amount: Math.round(data.totalAmount),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: data.userEmail,
      success_url: `${origin}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelado`,
      metadata: {
        type: 'plan_upgrade',
        userId: data.userId,
        plan: data.planId,
        cycle: data.billingCycle
      },
    });

    return { url: session.url };
  } catch (error: any) {
    throw new Error(error.message || 'Erro ao gerar checkout do plano');
  }
}

export async function getStripeSession(sessionId: string) {
  try {
    const stripe = await getStripeInstance();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session;
  } catch (error) {
    return null;
  }
}
