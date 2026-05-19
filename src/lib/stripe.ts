
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('AVISO: STRIPE_SECRET_KEY não configurada no ambiente.');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18',
  typescript: true,
});
