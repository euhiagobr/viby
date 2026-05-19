
import Stripe from 'stripe';

/**
 * Este arquivo é mantido para compatibilidade, mas as Server Actions 
 * agora buscam a chave dinamicamente do banco de dados para evitar 
 * dependência de variáveis de ambiente no Firebase Studio.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20',
  typescript: true,
});
