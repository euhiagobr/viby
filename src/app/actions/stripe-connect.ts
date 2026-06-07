'use server';

import { headers } from 'next/headers';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { recordAuditLog } from './audit';

async function getStripeInstance(db: admin.firestore.Firestore) {
  console.log('[Stripe-Debug] Fetching Stripe settings from Firestore...');
  const stripeSettingsRef = db.collection('settings').doc('stripe');
  const snap = await stripeSettingsRef.get();
  
  if (!snap.exists) {
    console.error('[Stripe-Debug] CRITICAL: Document settings/stripe not found.');
    throw new Error('Configurações do Stripe não localizadas no Firestore (settings/stripe).');
  }

  const data = snap.data();
  const secretKey = data?.secretKey?.trim();
  
  if (!secretKey) {
    console.error('[Stripe-Debug] CRITICAL: Stripe Secret Key is missing in admin panel.');
    throw new Error('Secret Key do Stripe ausente no painel administrativo.');
  }
  
  console.log('[Stripe-Debug] Stripe instance initialized successfully.');
  return new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' as any });
}

/**
 * Mapeia erros técnicos do Stripe para mensagens amigáveis de configuração.
 */
function handleStripeError(error: any): string {
  const message = error.message || '';
  if (message.includes('rak_account_link_write') || message.includes('permissions')) {
    return "Sua chave de API do Stripe (Restricted Key) não tem permissão para criar links de onboarding. No seu Dashboard do Stripe, edite a chave e conceda permissão de 'Write' para 'Account Links'. Ou use sua Secret Key (sk_live_...) principal.";
  }
  return message || 'Erro desconhecido na comunicação com o Stripe.';
}

export async function createStripeConnectAccount(orgId: string) {
  console.log(`[Stripe-Debug] Starting Connect Account creation for Org: ${orgId}`);
  try {
    const db = getAdminDb();
    const orgRef = db.collection('organizations').doc(orgId);
    const orgSnap = await orgRef.get();

    if (!orgSnap.exists) {
      console.error(`[Stripe-Debug] Error: Organization ${orgId} not found.`);
      throw new Error('Organização não encontrada.');
    }
    
    const orgData = orgSnap.data()!;
    let accountId = orgData.stripeAccountId;

    if (!accountId) {
      console.log(`[Stripe-Debug] No existing account ID. Creating new Express account for ${orgData.name}...`);
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
      console.log(`[Stripe-Debug] Success! New Stripe Account created: ${accountId}`);

      await orgRef.update({
        stripeAccountId: accountId,
        stripeOnboardingComplete: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`[Stripe-Debug] Firestore updated with stripeAccountId.`);
    } else {
      console.log(`[Stripe-Debug] Reusing existing Stripe Account: ${accountId}`);
    }

    const linkRes = await createAccountOnboardingLink(orgId, accountId);
    if (!linkRes.success) {
      console.error(`[Stripe-Debug] Link generation failed: ${linkRes.error}`);
      throw new Error(linkRes.error);
    }

    await recordAuditLog({
      organizationId: orgId,
      action: 'stripe_operation',
      category: 'finance',
      success: true,
      metadata: { op: 'connect_account_init', accountId }
    });

    return { success: true, accountId, url: linkRes.url };
  } catch (error: any) {
    console.error("[Stripe-Debug] FATAL ERROR in createStripeConnectAccount:", error.message);
    return { success: false, error: handleStripeError(error) };
  }
}

export async function createAccountOnboardingLink(orgId: string, accountId: string) {
  console.log(`[Stripe-Debug] Generating Onboarding Link for: ${accountId}`);
  try {
    const db = getAdminDb();
    const stripe = await getStripeInstance(db);
    const head = await headers();
    const origin = head.get('origin') || 'https://viby.club';
    
    console.log(`[Stripe-Debug] Using origin for callbacks: ${origin}`);

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/dashboard/financeiro`,
      return_url: `${origin}/dashboard/financeiro`,
      type: 'account_onboarding',
    });

    console.log(`[Stripe-Debug] Onboarding Link generated: ${accountLink.url.substring(0, 50)}...`);
    return { success: true, url: accountLink.url };
  } catch (error: any) {
    console.error("[Stripe-Debug] Error in createAccountOnboardingLink:", error.message);
    return { success: false, error: handleStripeError(error) };
  }
}

export async function retrieveStripeAccount(accountId: string, orgId?: string) {
  console.log(`[Stripe-Debug] Retrieving account state: ${accountId}`);
  try {
    const db = getAdminDb();
    const stripe = await getStripeInstance(db);
    
    const account = await stripe.accounts.retrieve(accountId);
    console.log(`[Stripe-Debug] Account retrieved. Charges Enabled: ${account.charges_enabled}`);

    if (orgId) {
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
    console.error("[Stripe-Debug] Error in retrieveStripeAccount:", error);
    
    if (error.code === 'resource_missing' && orgId) {
      console.warn(`[Stripe-Debug] Account not found in Stripe. Cleaning up Firestore for org: ${orgId}`);
      const db = getAdminDb();
      await db.collection('organizations').doc(orgId).update({
        stripeAccountId: admin.firestore.FieldValue.delete(),
        stripeOnboardingComplete: false,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        "payoutSettings.status": 'none',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { 
        success: false, 
        error: 'A conta vinculada não existe mais no Stripe. O vínculo foi removido para que você possa tentar conectar novamente.' 
      };
    }

    return { success: false, error: handleStripeError(error) };
  }
}
