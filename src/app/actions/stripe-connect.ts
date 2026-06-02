'use server';

import { headers } from 'next/headers';
import Stripe from 'stripe';
import { doc, getDoc, getFirestore, updateDoc, serverTimestamp } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

/**
 * @fileOverview Server Actions para Stripe Connect Express com proteção de integridade.
 */

async function getFirebaseComponents() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const db = getFirestore(app);
  return { db };
}

async function getStripeInstance(db: any) {
  const stripeSettingsRef = doc(db, 'settings', 'stripe');
  const snap = await getDoc(stripeSettingsRef);
  
  if (!snap.exists()) {
    throw new Error('Configurações do Stripe não localizadas.');
  }

  const data = snap.data();
  const secretKey = data?.secretKey?.trim();
  
  if (!secretKey) {
    throw new Error('Secret Key do Stripe ausente.');
  }
  
  return new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' as any });
}

/**
 * Cria ou recupera uma conta Stripe Connect Express para a organização.
 */
export async function createStripeConnectAccount(orgId: string) {
  try {
    const { db } = await getFirebaseComponents();
    const orgRef = doc(db, 'organizations', orgId);
    const orgSnap = await getDoc(orgRef);

    if (!orgSnap.exists()) {
      throw new Error('Organização não encontrada.');
    }
    
    const orgData = orgSnap.data();
    let accountId = orgData.stripeAccountId;

    if (!accountId) {
      const stripe = await getStripeInstance(db);
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'BR',
        email: orgData.contactEmail || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'company',
        company: {
          name: orgData.legalName || orgData.name,
          tax_id: orgData.cnpj?.replace(/\D/g, ''),
        },
        metadata: { orgId }
      });
      
      accountId = account.id;

      await updateDoc(orgRef, {
        stripeAccountId: accountId,
        stripeOnboardingComplete: false,
        updatedAt: serverTimestamp()
      });
    }

    const linkRes = await createAccountOnboardingLink(orgId, accountId);
    if (!linkRes.success) throw new Error(linkRes.error);

    return { success: true, accountId, url: linkRes.url };
  } catch (error: any) {
    console.error("[Stripe Action Error]", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Gera o link de onboarding do Stripe.
 */
export async function createAccountOnboardingLink(orgId: string, accountId: string) {
  try {
    const { db } = await getFirebaseComponents();
    const stripe = await getStripeInstance(db);
    const head = await headers();
    const origin = head.get('origin') || 'https://viby.club';

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/dashboard/financeiro`,
      return_url: `${origin}/dashboard/financeiro`,
      type: 'account_onboarding',
    });

    return { success: true, url: accountLink.url };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Recupera os dados de uma conta diretamente da API do Stripe para diagnóstico.
 */
export async function retrieveStripeAccount(accountId: string) {
  try {
    const { db } = await getFirebaseComponents();
    const stripe = await getStripeInstance(db);
    const account = await stripe.accounts.retrieve(accountId);

    return {
      success: true,
      data: {
        id: account.id,
        details_submitted: account.details_submitted,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        requirements: {
          currently_due: account.requirements?.currently_due || [],
          eventually_due: account.requirements?.eventually_due || [],
          past_due: account.requirements?.past_due || [],
          disabled_reason: account.requirements?.disabled_reason || null
        }
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
