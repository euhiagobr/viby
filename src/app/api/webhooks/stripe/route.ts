
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { getAffiliateLevel, AFFILIATE_SAFETY_DAYS } from '@/lib/affiliate-utils';

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
    
    // A validação de assinatura é OBRIGATÓRIA para produção
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
    } else {
      console.warn("[Stripe Webhook] Alerta: Webhook Secret não configurado. Utilizando modo inseguro.");
      event = JSON.parse(payload);
    }
  } catch (err: any) {
    console.error(`[Stripe Webhook Error] Signature failed: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // FLUXO: COMPRA DE INGRESSOS
        if (session.metadata?.type === 'order_checkout' && session.metadata?.orderId) {
          const orderId = session.metadata.orderId;
          const orderRef = db.collection("orders").doc(orderId);
          const orderSnap = await orderRef.get();
          
          if (orderSnap.exists && orderSnap.data()?.status !== 'paid') {
            await db.runTransaction(async (transaction) => {
              const orderData = orderSnap.data()!;
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

                if (orgSnap.exists) {
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
                      price: item.financials?.customerFinalPrice || item.price,
                      currency: currency,
                      producerNetAmount: item.financials?.producerNetAmount || item.price,
                      ticketTypeName: item.ticketTypeName,
                      batchName: item.batchName,
                      paymentStatus: "Pago",
                      status: "active",
                      ticketCode,
                      stripeSessionId: session.id,
                      orderId,
                      affiliateId: isAffiliateValid ? affiliateId : null,
                      confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
                      createdAt: admin.firestore.FieldValue.serverTimestamp(),
                      timestamp: admin.firestore.FieldValue.serverTimestamp()
                    });
                  }

                  // Processamento de comissão de afiliado automático
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
              transaction.update(orderRef, { status: 'paid', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            });
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
          console.log(`[Stripe Webhook] KYC Sync for org: ${orgId}`);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;
        
        if (paymentIntentId) {
          // Localizar ingressos vinculados a este pagamento para cancelamento automático
          const regsSnap = await db.collection("registrations")
            .where("stripePaymentIntentId", "==", paymentIntentId)
            .get();
          
          if (!regsSnap.empty) {
            const batch = db.batch();
            regsSnap.forEach(d => {
              batch.update(d.ref, {
                status: 'cancelled',
                paymentStatus: 'Estornado (Dashboard)',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            });
            await batch.commit();
            console.log(`[Stripe Webhook] Refund sync for ${regsSnap.size} tickets`);
          }
        }
        break;
      }
    }
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[Stripe Webhook Error]", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
