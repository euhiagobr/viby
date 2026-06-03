
'use server';

import { headers } from 'next/headers';
import Stripe from 'stripe';
import { doc, getDoc, getFirestore, updateDoc, serverTimestamp } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { recordAuditLog } from './audit';

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
    throw new Error('Configurações do Stripe não localizadas no Firestore (settings/stripe).');
  }

  const data = snap.data();
  const secretKey = data?.secretKey?.trim();
  
  if (!secretKey) {
    throw new Error('Secret Key do Stripe ausente no painel administrativo.');
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
      console.log(`[AUDIT] Criando nova conta Stripe para org: ${orgId}`);
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

      // Persistência com proteção de regras customizadas
      await updateDoc(orgRef, {
        stripeAccountId: accountId,
        stripeOnboardingComplete: false,
        updatedAt: serverTimestamp()
      });
      console.log(`[AUDIT] stripeAccountId salvo com sucesso: ${accountId}`);
    }

    const linkRes = await createAccountOnboardingLink(orgId, accountId);
    if (!linkRes.success) throw new Error(linkRes.error);

    await recordAuditLog({
      organizationId: orgId,
      action: 'stripe_operation',
      category: 'finance',
      success: true,
      metadata: { op: 'connect_account_init', accountId }
    });

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
 * Recupera os dados de uma conta diretamente da API do Stripe e SINCRONIZA com o Firestore.
 */
export async function retrieveStripeAccount(accountId: string, orgId?: string) {
  try {
    const { db } = await getFirebaseComponents();
    const stripe = await getStripeInstance(db);
    
    console.log(`[Diagnostic] Consulting Stripe for account: ${accountId}`);
    const account = await stripe.accounts.retrieve(accountId);

    // LÓGICA DE SINCRONIZAÇÃO FORÇADA
    if (orgId) {
      console.log(`[Diagnostic] Syncing Stripe state to Firestore for org: ${orgId}`);
      const orgRef = doc(db, 'organizations', orgId);
      
      const isApproved = account.charges_enabled && account.payouts_enabled;
      
      await updateDoc(orgRef, {
        stripeOnboardingComplete: account.details_submitted,
        stripeChargesEnabled: account.charges_enabled,
        stripePayoutsEnabled: account.payouts_enabled,
        stripeDetailsSubmitted: account.details_submitted,
        "payoutSettings.status": isApproved ? 'verified' : (account.details_submitted ? 'pending_admin' : 'none'),
        updatedAt: serverTimestamp()
      });

      await recordAuditLog({
        organizationId: orgId,
        action: 'stripe_operation',
        category: 'finance',
        success: true,
        metadata: { op: 'account_sync', accountId, charges: account.charges_enabled }
      });
    }

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
    console.error("[Stripe Diagnostic Action Error]", error);
    return { success: false, error: error.message || 'Erro desconhecido ao consultar Stripe API.' };
  }
}
