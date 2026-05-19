
import Stripe from 'stripe';

/**
 * Este arquivo é mantido para compatibilidade, mas as Server Actions 
 * agora buscam a chave dinamicamente do banco de dados para evitar 
 * dependência de variáveis de ambiente no Firebase Studio.
 * Removido apiVersion explícito para evitar erros de compatibilidade.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  typescript: true,
});
