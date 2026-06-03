
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { doc, getFirestore, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, limit, increment, addDoc } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { recordAuditLog } from '@/app/actions/audit';

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
    await recordAuditLog({
      action: 'stripe_operation',
      category: 'finance',
      success: true,
      metadata: { type: 'webhook_received', event: event.type, eventId: event.id }
    });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Trata recargas de Ad Balance
        if (session.metadata?.type === 'ad_topup') {
          const orgId = session.metadata.orgId;
          const userId = session.metadata.userId;
          const amount = parseFloat(session.metadata.baseAmount);
          const finalBalance = parseFloat(session.metadata.finalBalance);
          const totalPaid = parseFloat(session.metadata.totalPaid);
          const orgRef = doc(db, 'organizations', orgId);
          
          // Verificação de duplicidade por session ID antes de gravar
          const txQ = query(collection(db, 'organizations', orgId, 'transactions'), where('stripeSessionId', '==', session.id), limit(1));
          const txSnap = await getDocs(txQ);
          
          if (txSnap.empty) {
            await updateDoc(orgRef, {
              adBalance: increment(finalBalance),
              updatedAt: serverTimestamp()
            });

            await addDoc(collection(db, 'organizations', orgId, 'transactions'), {
              type: 'ad_topup',
              userId: userId,
              amount: finalBalance,
              totalCharged: totalPaid,
              couponCode: session.metadata.couponCode || null,
              status: 'completed',
              stripeSessionId: session.id,
              description: `Recarga de Saldo Ads (Webhook)${session.metadata.couponCode ? ` (Cupom: ${session.metadata.couponCode})` : ''}`,
              createdAt: serverTimestamp()
            });

            await recordAuditLog({
              userId,
              organizationId: orgId,
              action: 'ad_topup_success',
              category: 'finance',
              success: true,
              metadata: { amount, finalBalance, sessionId: session.id }
            });
          }
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

          await recordAuditLog({
            organizationId: orgId,
            action: 'stripe_operation',
            category: 'finance',
            success: true,
            metadata: { op: 'account_updated_webhook', charges: account.charges_enabled }
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
