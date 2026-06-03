
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { doc, getFirestore, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, limit, increment } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

export const dynamic = 'force-dynamic';

/**
 * @fileOverview Webhook central do Stripe para sincronização Connect e Checkout.
 */

async function getFirebaseDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

async function getStripeInstance(db: any) {
  const snap = await getDoc(doc(db, 'settings', 'stripe'));
  const data = snap.data();
  if (!data?.secretKey) throw new Error("Stripe Secret Key not found in DB.");
  return new Stripe(data.secretKey, { apiVersion: '2024-12-18.acacia' as any });
}

export async function POST(req: Request) {
  const db = await getFirebaseDb();
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    const stripe = await getStripeInstance(db);
    const stripeSettings = (await getDoc(doc(db, 'settings', 'stripe'))).data();
    const webhookSecret = stripeSettings?.webhookSecret;
    
    if (!webhookSecret) {
      // Fallback para ambiente Studio sem webhookSecret configurado
      event = JSON.parse(payload);
    } else {
      event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
    }
  } catch (err: any) {
    console.error(`[Webhook Error] ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Trata recargas de Ad Balance
        if (session.metadata?.type === 'ad_topup') {
          const orgId = session.metadata.orgId;
          const amount = parseFloat(session.metadata.baseAmount);
          const orgRef = doc(db, 'organizations', orgId);
          
          await updateDoc(orgRef, {
            adBalance: increment(amount),
            updatedAt: serverTimestamp()
          });

          await addDoc(collection(db, 'organizations', orgId, 'transactions'), {
            type: 'ad_topup',
            amount,
            status: 'completed',
            stripeSessionId: session.id,
            description: 'Recarga de Saldo Ads (Webhook)',
            createdAt: serverTimestamp()
          });
        }
        break;
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        const orgId = account.metadata?.orgId;
        
        if (orgId) {
          console.log(`[Webhook] Syncing account ${account.id} for org ${orgId}`);
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
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook Processing Error]', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
