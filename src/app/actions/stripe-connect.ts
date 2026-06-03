'use server';

import { headers } from 'next/headers';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { recordAuditLog } from './audit';

async function getStripeInstance(db: admin.firestore.Firestore) {
  const stripeSettingsRef = db.collection('settings').doc('stripe');
  const snap = await stripeSettingsRef.get();
  
  if (!snap.exists) {
    throw new Error('Configurações do Stripe não localizadas no Firestore (settings/stripe).');
  }

  const data = snap.data();
  const secretKey = data?.secretKey?.trim();
  
  if (!secretKey) {
    throw new Error('Secret Key do Stripe ausente no painel administrativo.');
  }
  
  return new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' as any });
}

export async function createStripeConnectAccount(orgId: string) {
  try {
    const db = getAdminDb();
    const orgRef = db.collection('organizations').doc(orgId);
    const orgSnap = await orgRef.get();

    if (!orgSnap.exists) {
      throw new Error('Organização não encontrada.');
    }
    
    const orgData = orgSnap.data()!;
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

      await orgRef.update({
        stripeAccountId: accountId,
        stripeOnboardingComplete: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
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

export async function createAccountOnboardingLink(orgId: string, accountId: string) {
  try {
    const db = getAdminDb();
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

export async function retrieveStripeAccount(accountId: string, orgId?: string) {
  try {
    const db = getAdminDb();
    const stripe = await getStripeInstance(db);
    
    console.log(`[Diagnostic] Consulting Stripe for account: ${accountId}`);
    const account = await stripe.accounts.retrieve(accountId);

    if (orgId) {
      console.log(`[Diagnostic] Syncing Stripe state to Firestore for org: ${orgId}`);
      const orgRef = db.collection('organizations').doc(orgId);
      
      const isApproved = account.charges_enabled && account.payouts_enabled;
      
      await orgRef.update({
        stripeOnboardingComplete: account.details_submitted,
        stripeChargesEnabled: account.charges_enabled,
        stripePayoutsEnabled: account.payouts_enabled,
        stripeDetailsSubmitted: account.details_submitted,
        "payoutSettings.status": isApproved ? 'verified' : (account.details_submitted ? 'pending_admin' : 'none'),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
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