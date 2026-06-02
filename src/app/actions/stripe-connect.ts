
'use server';

import { headers } from 'next/headers';
import Stripe from 'stripe';
import { doc, getDoc, getFirestore, updateDoc, serverTimestamp } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

/**
 * @fileOverview Server Actions para Stripe Connect Express com Logs de Auditoria.
 */

async function getFirebaseComponents() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const db = getFirestore(app);
  return { db };
}

async function getStripeInstance(db: any) {
  console.log("[AUDIT] Iniciando getStripeInstance...");
  const stripeSettingsRef = doc(db, 'settings', 'stripe');
  
  console.log("[AUDIT] Tentando ler documento: settings/stripe");
  const snap = await getDoc(stripeSettingsRef);
  
  if (!snap.exists()) {
    console.error("[AUDIT] ERRO: Documento settings/stripe não localizado.");
    throw new Error('Configurações do Stripe não localizadas.');
  }

  console.log("[AUDIT] Sucesso: Configurações carregadas do Firestore.");
  const data = snap.data();
  const secretKey = data?.secretKey?.trim();
  
  if (!secretKey) {
    console.error("[AUDIT] ERRO: Secret Key ausente no documento.");
    throw new Error('Secret Key do Stripe ausente.');
  }
  
  return new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' as any });
}

/**
 * Cria ou recupera uma conta Stripe Connect Express para a organização.
 */
export async function createStripeConnectAccount(orgId: string) {
  console.group(`[AUDIT] createStripeConnectAccount - ORG: ${orgId}`);
  try {
    const { db } = await getFirebaseComponents();
    const stripe = await getStripeInstance(db);
    
    const orgRef = doc(db, 'organizations', orgId);
    console.log("[AUDIT] Tentando ler documento da organização...");
    const orgSnap = await getDoc(orgRef);

    if (!orgSnap.exists()) {
      console.error("[AUDIT] ERRO: Organização não encontrada no Firestore.");
      throw new Error('Organização não encontrada.');
    }
    
    const orgData = orgSnap.data();
    let accountId = orgData.stripeAccountId;

    if (!accountId) {
      console.log("[AUDIT] Iniciando chamada API Stripe: accounts.create...");
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
      console.log(`[AUDIT] Sucesso Stripe: Conta criada ID: ${accountId}`);

      console.log("[AUDIT] Tentando salvar stripeAccountId no Firestore (updateDoc)...");
      // ESTE É O PONTO CRÍTICO DE FALHA
      await updateDoc(orgRef, {
        stripeAccountId: accountId,
        stripeOnboardingComplete: false,
        updatedAt: serverTimestamp()
      });
      console.log("[AUDIT] Sucesso: Firestore atualizado.");
    }

    return { success: true, accountId };
  } catch (error: any) {
    console.error("[AUDIT] FALHA CRÍTICA:", error.message);
    if (error.code === 'permission-denied') {
      console.error("[AUDIT] DIAGNÓSTICO: PERMISSION_DENIED no Firestore.");
    }
    return { success: false, error: error.message };
  } finally {
    console.groupEnd();
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

    console.log(`[AUDIT] Gerando link de onboarding para: ${accountId}`);
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/dashboard/financeiro`,
      return_url: `${origin}/dashboard/financeiro`,
      type: 'account_onboarding',
    });

    return { success: true, url: accountLink.url };
  } catch (error: any) {
    console.error("[AUDIT] Erro ao gerar link:", error.message);
    return { success: false, error: error.message };
  }
}
