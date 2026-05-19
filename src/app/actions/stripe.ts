
'use server';

import { headers } from 'next/headers';
import Stripe from 'stripe';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

/**
 * Helper para obter as chaves do Stripe diretamente do Firestore.
 * Necessário pois o usuário não tem acesso ao .env.
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
    const { secretKey } = await getStripeKeys();
    if (!secretKey) throw new Error('Stripe Secret Key não configurada.');

    const stripe = new Stripe(secretKey, {
      apiVersion: '2025-01-27-preview',
      typescript: true,
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
      metadata: {
        ...data.metadata,
        eventId: data.eventId,
        userId: data.userId,
        userName: data.userName,
        userEmail: data.userEmail,
      },
    });

    return { url: session.url };
  } catch (error: any) {
    console.error('Erro Stripe:', error);
    throw new Error(error.message || 'Erro ao processar pagamento');
  }
}

export async function getStripeSession(sessionId: string) {
  try {
    const { secretKey } = await getStripeKeys();
    const stripe = new Stripe(secretKey, {
      apiVersion: '2025-01-27-preview',
      typescript: true,
    });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session;
  } catch (error) {
    return null;
  }
}
