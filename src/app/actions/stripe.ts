
'use server';

import { stripe } from '@/lib/stripe';
import { headers } from 'next/headers';

export async function createCheckoutSession(data: {
  eventId: string;
  eventTitle: string;
  eventImage: string;
  userId: string;
  userName: string;
  userEmail: string;
  totalAmount: number; // Em centavos para o Stripe
  metadata: any;
}) {
  const origin = (await headers()).get('origin');

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'], // No Brasil você pode habilitar 'pix' e 'boleto' no painel do Stripe
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
    console.error('Erro ao criar sessão Stripe:', error);
    throw new Error(error.message || 'Erro ao processar pagamento');
  }
}

export async function getStripeSession(sessionId: string) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session;
  } catch (error) {
    return null;
  }
}
