
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { getAffiliateLevel, AFFILIATE_SAFETY_DAYS } from '@/lib/affiliate-utils';
import { sendTicketEmail } from '@/app/actions/email';

export const dynamic = 'force-dynamic';

async function getStripeInstance(db: admin.firestore.Firestore) {
  const snap = await db.collection('settings').doc('stripe').get();
  const data = snap.data();
  if (!data?.secretKey) throw new Error("Stripe Secret Key not found.");
  return new Stripe(data.secretKey, { apiVersion: '2024-12-18.acacia' as any });
}

export async function POST(req: Request) {
  const db = getAdminDb();
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    const stripe = await getStripeInstance(db);
    const stripeSettingsSnap = await db.collection('settings').doc('stripe').get();
    const stripeSettings = stripeSettingsSnap.data();
    const webhookSecret = stripeSettings?.webhookSecret;
    
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
    } else {
      event = JSON.parse(payload);
    }
  } catch (err: any) {
    console.error(`[Stripe Webhook] Signature Verification Failed: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // IDEMPOTÊNCIA NÍVEL 1: Registro do Event ID do Stripe
  const eventLogRef = db.collection('stripe_processed_events').doc(event.id);
  const eventLogSnap = await eventLogRef.get();
  if (eventLogSnap.exists) {
    return NextResponse.json({ received: true, reason: 'event_already_processed' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.metadata?.type === 'order_checkout' && session.metadata?.orderId) {
          const orderId = session.metadata.orderId;
          const orderRef = db.collection("orders").doc(orderId);

          // IDEMPOTÊNCIA NÍVEL 2: Transação Atômica verificando Status da Ordem
          await db.runTransaction(async (transaction) => {
            const orderSnap = await transaction.get(orderRef);
            
            if (!orderSnap.exists) throw new Error("Order not found");
            const orderData = orderSnap.data()!;

            // BLOQUEIO: Se já estiver pago, não processa novamente
            if (orderData.status === 'paid') {
              console.log(`[Stripe Webhook] Order ${orderId} already paid. Skipping.`);
              return;
            }

            const userId = session.metadata!.userId;
            const items = orderData.items || [];
            const currency = (orderData.currency || 'BRL').toUpperCase();

            for (const item of items) {
              const targetRef = item.occurrenceId 
                ? db.collection("recurring_occurrences").doc(item.occurrenceId) 
                : db.collection("events").doc(item.eventId);
              
              transaction.update(targetRef, { 
                ingressosVendidos: admin.firestore.FieldValue.increment(item.quantity),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });

              const orgRef = db.collection("organizations").doc(item.organizationId);
              const orgSnap = await transaction.get(orgRef);
              const regIds: string[] = [];

              if (orgSnap.exists()) {
                const org = orgSnap.data()!;
                const affiliateId = org.originalAffiliateId;
                const affExpireAt = org.affiliateExpireAt ? new Date(org.affiliateExpireAt) : null;
                const isAffiliateValid = affiliateId && affExpireAt && new Date() <= affExpireAt;

                for (let j = 0; j < item.quantity; j++) {
                  const ticketCode = Math.random().toString(36).substring(2, 10).toUpperCase();
                  const regRef = db.collection("registrations").doc();
                  regIds.push(regRef.id);
                  
                  transaction.set(regRef, {
                    eventId: item.eventId,
                    eventTitle: item.eventTitle,
                    eventImage: item.eventImage || '',
                    eventDate: item.eventDate,
                    eventCity: item.eventCity,
                    userId: userId,
                    userName: orderData.userName,
                    userEmail: orderData.userEmail,
                    organizationId: item.organizationId,
                    ticketBasePrice: item.price,
                    price: item.price + (item.administrativeFeeAmount || 0),
                    currency: currency,
                    producerNetAmount: item.producerNetAmount || item.price,
                    administrativeFeeAmount: item.administrativeFeeAmount || 0,
                    ticketTypeName: item.ticketTypeName,
                    batchName: item.batchName,
                    paymentStatus: "Pago",
                    status: "active",
                    ticketCode,
                    stripeSessionId: session.id,
                    stripePaymentIntentId: session.payment_intent,
                    orderId,
                    confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                  });

                  sendTicketEmail({
                    to: orderData.userEmail,
                    userName: orderData.userName,
                    eventTitle: item.eventTitle,
                    ticketCode,
                    eventDate: item.eventDate,
                    eventCity: item.eventCity,
                    voucherUrl: `https://viby.club/dashboard/ingressos/${regRef.id}/voucher`
                  }).catch(e => console.error("[Webhook Email Error]", e));
                }

                if (isAffiliateValid) {
                  const statsRef = db.collection("affiliate_stats").doc(affiliateId);
                  const statsSnap = await transaction.get(statsRef);
                  const stats = statsSnap.data() || { totalTicketsSold: 0, balances: {} };
                  const level = getAffiliateLevel(stats.totalTicketsSold + item.quantity);
                  const commissionAmount = level.commission * item.quantity;
                  const availableDate = new Date();
                  availableDate.setDate(availableDate.getDate() + AFFILIATE_SAFETY_DAYS);

                  const commRef = db.collection("affiliate_commissions").doc();
                  transaction.set(commRef, {
                    affiliateId,
                    referredUserId: org.originalOwnerId,
                    organizationId: item.organizationId,
                    eventId: item.eventId,
                    registrationIds: regIds,
                    amount: commissionAmount,
                    currency: currency,
                    status: 'pending',
                    availableAt: admin.firestore.Timestamp.fromDate(availableDate),
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                  });

                  transaction.update(statsRef, {
                     totalTicketsSold: admin.firestore.FieldValue.increment(item.quantity),
                     [`balances.${currency}.pending`]: admin.firestore.FieldValue.increment(commissionAmount),
                     [`balances.${currency}.totalEarned`]: admin.firestore.FieldValue.increment(commissionAmount),
                     currentLevel: level.level,
                     updatedAt: admin.firestore.FieldValue.serverTimestamp()
                  });
                }
              }
            }
            
            transaction.update(orderRef, { 
              status: 'paid', 
              stripePaymentIntentId: session.payment_intent,
              updatedAt: admin.firestore.FieldValue.serverTimestamp() 
            });

            // Registrar log do evento processado
            transaction.set(eventLogRef, {
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              type: event.type,
              orderId
            });
          });
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const orderId = intent.metadata?.orderId;
        if (orderId) {
          await db.collection("orders").doc(orderId).update({
            status: 'failed',
            lastError: intent.last_payment_error?.message || 'Payment failed',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;
        if (paymentIntentId) {
          const regsSnap = await db.collection("registrations").where("stripePaymentIntentId", "==", paymentIntentId).get();
          if (!regsSnap.empty) {
            const batch = db.batch();
            regsSnap.forEach(d => {
              batch.update(d.ref, {
                status: 'refunded',
                paymentStatus: 'Estornado (Stripe)',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            });
            await batch.commit();
          }
        }
        break;
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        const orgId = account.metadata?.orgId;
        if (orgId) {
          const isVerified = account.charges_enabled && account.payouts_enabled;
          await db.collection('organizations').doc(orgId).update({
            stripeChargesEnabled: account.charges_enabled,
            stripePayoutsEnabled: account.payouts_enabled,
            stripeOnboardingComplete: account.details_submitted,
            "payoutSettings.status": isVerified ? 'verified' : (account.details_submitted ? 'pending_admin' : 'none'),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        break;
      }
    }
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error(`[Stripe Webhook Error] Process Failure: ${error.message}`);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
