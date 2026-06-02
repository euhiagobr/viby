'use server';

import Stripe from 'stripe';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

async function getDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

/**
 * @fileOverview Server Action para Auditoria de Conta Stripe.
 * Executa a chamada accounts.retrieve() para validar a integração Connect.
 */
export async function runStripeAudit() {
  try {
    const db = await getDb();
    const snap = await getDoc(doc(db, 'settings', 'stripe'));
    
    if (!snap.exists()) {
      return { success: false, error: 'Documento settings/stripe não encontrado no Firestore.' };
    }

    const data = snap.data();
    const secretKey = data?.secretKey?.trim();

    if (!secretKey) {
      return { success: false, error: 'Secret Key não configurada no painel administrativo.' };
    }

    const stripe = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' as any });
    const account = await stripe.accounts.retrieve();

    return {
      success: true,
      data: {
        id: account.id,
        email: account.email,
        country: account.country,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        type: account.type,
        raw: account
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message, stack: error.stack };
  }
}
