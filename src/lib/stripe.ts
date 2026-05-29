/**
 * @fileOverview Limpeza do arquivo de inicialização estática do Stripe.
 * Conforme o novo OBJETIVO, o Stripe deve ser instanciado dinamicamente
 * dentro das Server Actions, buscando as chaves do Firestore em cada requisição.
 * PROIBIDO: const stripe = new Stripe(process.env...)
 */

// Este arquivo é mantido apenas como referência de tipos se necessário,
// mas a lógica real foi movida para @/app/actions/stripe.ts

export const dynamic = 'force-dynamic';
