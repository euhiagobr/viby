
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { doc, getFirestore, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, limit, increment, addDoc, writeBatch } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { recordAuditLog } from '@/app/actions/audit';
import { finalizeCheckoutSession } from '@/app/actions/stripe';

export const dynamic = 'force-dynamic';

async function getFirebaseDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

async function getStripeInstance(db: any) {
  const snap = await getDoc(doc(db, 'settings', 'stripe'));
  const data = snap.data();
  if (!data?.secretKey) throw new Error("Stripe Secret Key not found.");
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
    
    event = webhookSecret 
      ? stripe.webhooks.constructEvent(payload, sig, webhookSecret)
      : JSON.parse(payload);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      // CORREÇÃO CRÍTICA 01: Fulfillment centralizado no servidor
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.metadata?.type === 'order_checkout') {
          await finalizeCheckoutSession(session.id);
          console.log(`[Webhook] Fulfillment concluded for order: ${session.metadata.orderId}`);
        }
        
        // Recargas Ad Balance
        if (session.metadata?.type === 'ad_topup') {
          const orgId = session.metadata.orgId;
          const finalBalance = parseFloat(session.metadata.finalBalance);
          const txQ = query(collection(db, 'organizations', orgId, 'transactions'), where('stripeSessionId', '==', session.id), limit(1));
          const txSnap = await getDocs(txQ);
          
          if (txSnap.empty) {
            await updateDoc(doc(db, 'organizations', orgId), {
              adBalance: increment(finalBalance),
              updatedAt: serverTimestamp()
            });
            await addDoc(collection(db, 'organizations', orgId, 'transactions'), {
              type: 'ad_topup',
              amount: finalBalance,
              status: 'completed',
              stripeSessionId: session.id,
              createdAt: serverTimestamp()
            });
          }
        }
        break;
      }

      // CORREÇÃO CRÍTICA 05: Sincronização de estornos externos
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;
        
        if (paymentIntentId) {
          const regsQ = query(collection(db, "registrations"), where("paymentIntentId", "==", paymentIntentId));
          const regsSnap = await getDocs(regsQ);
          
          if (!regsSnap.empty) {
            const batch = writeBatch(db);
            regsSnap.forEach(regDoc => {
              const data = regDoc.data();
              if (data.status !== 'refunded') {
                batch.update(regDoc.ref, { 
                  status: 'refunded', 
                  paymentStatus: 'Estornado (Dashboard)',
                  updatedAt: serverTimestamp() 
                });
                // Devolve capacidade
                const targetRef = data.occurrenceId ? doc(db, "recurring_occurrences", data.occurrenceId) : doc(db, "events", data.eventId);
                batch.update(targetRef, { ingressosVendidos: increment(-1) });
              }
            });
            await batch.commit();
            console.log(`[Webhook] Synced external refund for PI: ${paymentIntentId}`);
          }
        }
        break;
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        const orgId = account.metadata?.orgId;
        if (orgId) {
          const isApproved = account.charges_enabled && account.payouts_enabled;
          await updateDoc(doc(db, 'organizations', orgId), {
            stripeOnboardingComplete: account.details_submitted,
            stripeChargesEnabled: account.charges_enabled,
            stripePayoutsEnabled: account.payouts_enabled,
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
