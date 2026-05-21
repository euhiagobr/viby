
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
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app, 'eventosviby');
    
    const stripeDoc = await getDoc(doc(db, 'settings', 'stripe'));
    if (!stripeDoc.exists()) {
      return { publishableKey: null, secretKey: null };
    }
    const data = stripeDoc.data();
    return {
      publishableKey: data.publishableKey || null,
      secretKey: data.secretKey || null,
    };
  } catch (e) {
    console.error('Erro ao buscar chaves do Stripe no Firestore:', e);
    return { publishableKey: null, secretKey: null };
  }
}

/**
 * Inicializa uma instância do Stripe com a Secret Key do banco.
 */
async function getStripeInstance() {
  const { secretKey } = await getStripeKeys();
  if (!secretKey || typeof secretKey !== 'string') {
    throw new Error('A chave secreta do Stripe não foi configurada ou é inválida.');
  }
  
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
  try {
    const h = await headers();
    const origin = h.get('origin') || 'https://viby.club';

    const stripe = await getStripeInstance();

    const sanitizedMetadata: Record<string, string> = {};
    if (data.metadata) {
      Object.entries(data.metadata).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          sanitizedMetadata[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: data.eventTitle || 'Ingresso Viby',
              description: `Reserva de ingresso: ${data.metadata.ticketTypeName || 'Acesso Geral'}`,
              images: (data.eventImage && data.eventImage.startsWith('http')) ? [data.eventImage] : [],
            },
            unit_amount: Math.max(1, Math.round(data.totalAmount)),
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
    console.error('Erro crítico na Server Action createCheckoutSession:', error);
    throw new Error(error.message || 'Erro ao processar o checkout de pagamento');
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
  try {
    const h = await headers();
    const origin = h.get('origin') || 'https://viby.club';
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
            unit_amount: Math.max(1, Math.round(data.totalAmount)),
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
    console.error('Erro crítico na Server Action createPlanCheckoutSession:', error);
    throw new Error(error.message || 'Erro ao gerar checkout do plano');
  }
}

export async function createAdCheckoutSession(data: {
  adId: string;
  eventTitle: string;
  userId: string;
  userEmail: string;
  totalAmount: number; // Em centavos
}) {
  try {
    const h = await headers();
    const origin = h.get('origin') || 'https://viby.club';
    const stripe = await getStripeInstance();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `Impulsionamento: ${data.eventTitle}`,
              description: `Campanha de anúncio no Viby Club`,
            },
            unit_amount: Math.max(1, Math.round(data.totalAmount)),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: data.userEmail,
      success_url: `${origin}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelado`,
      metadata: {
        type: 'ad_payment',
        adId: data.adId,
        userId: data.userId,
      },
    });

    return { url: session.url };
  } catch (error: any) {
    console.error('Erro crítico na Server Action createAdCheckoutSession:', error);
    throw new Error(error.message || 'Erro ao gerar checkout do anúncio');
  }
}

export async function getStripeSession(sessionId: string) {
  if (!sessionId || typeof sessionId !== 'string') return null;
  try {
    const stripe = await getStripeInstance();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session;
  } catch (error) {
    console.error('Erro ao recuperar sessão Stripe:', error);
    return null;
  }
}
