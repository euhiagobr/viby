
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { sendTicketEmail } from '@/app/actions/email';
import { calculatePartnerCommissionValue } from '@/lib/partner-utils';

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

  const eventLogRef = db.collection('stripe_processed_events').doc(event.id);

  try {
    await db.runTransaction(async (transaction) => {
      const eventLogSnap = await transaction.get(eventLogRef);
      if (eventLogSnap.exists) {
        throw new Error("ALREADY_PROCESSED");
      }

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          
          if (session.metadata?.type === 'order_checkout' && session.metadata?.orderId) {
            const orderId = session.metadata.orderId;
            const orderRef = db.collection("orders").doc(orderId);
            const orderSnap = await transaction.get(orderRef);
            
            if (!orderSnap.exists) throw new Error("Order not found");
            const orderData = orderSnap.data()!;

            if (orderData.status === 'paid') return;

            const userId = session.metadata!.userId;
            const items = orderData.items || [];
            const currency = (orderData.currency || 'BRL').toUpperCase();

            const affConfigSnap = await transaction.get(db.collection('settings').doc('affiliates'));
            const isAffiliateEnabledGlobal = affConfigSnap.exists ? (affConfigSnap.data()?.enabled !== false) : true;

            const organizerId = orderData.organizerId || items[0]?.organizerId;

            let partnerRef = null;
            let partnerReferral = null;
            if (organizerId && isAffiliateEnabledGlobal) {
               const refDoc = await transaction.get(db.collection('partner_referrals').doc(organizerId));
               if (refDoc.exists) {
                  const rData = refDoc.data()!;
                  const now = admin.firestore.Timestamp.now();
                  if (rData.status === 'active' && rData.expiresAt > now) {
                     partnerReferral = rData;
                     partnerRef = db.collection('partners').doc(rData.partnerId);
                  }
               }
            }

            for (const item of items) {
              // 1. IDENTIFICAR ORIGEM DA BAIXA DE ESTOQUE
              const eventRef = db.collection("events").doc(item.eventId);
              
              // SEMPRE incrementa o total vendido da série
              transaction.update(eventRef, { 
                ingressosVendidos: admin.firestore.FieldValue.increment(item.quantity),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });

              // 2. SE FOR SESSÃO INDEPENDENTE, INCREMENTA A OCORRÊNCIA
              if (item.occurrenceId) {
                const occRef = db.collection("recurring_occurrences").doc(item.occurrenceId);
                const occSnap = await transaction.get(occRef);
                
                if (occSnap.exists()) {
                  transaction.update(occRef, {
                    ingressosVendidos: admin.firestore.FieldValue.increment(item.quantity),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                  });

                  // Se a ocorrência tem sua própria bilheteria, a baixa de lote ocorre nela
                  const occData = occSnap.data()!;
                  if (occData.batches && occData.batches.length > 0) {
                     // Lógica futura: decrementar 'quantity' dentro do array batches da ocorrência
                  }
                }
              }

              for (let j = 0; j < item.quantity; j++) {
                const ticketCode = Math.random().toString(36).substring(2, 10).toUpperCase();
                const regRef = db.collection("registrations").doc();
                
                const regData = {
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
                  occurrenceId: item.occurrenceId || null,
                  confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  timestamp: admin.firestore.FieldValue.serverTimestamp()
                };

                transaction.set(regRef, regData);

                if (partnerRef && partnerReferral && item.price > 0 && isAffiliateEnabledGlobal) {
                   const pSnap = await transaction.get(partnerRef);
                   if (pSnap.exists && pSnap.data()?.status === 'active') {
                      const pData = pSnap.data()!;
                      const commissionValue = calculatePartnerCommissionValue(item.price, pData.tiers || []);
                      
                      if (commissionValue > 0) {
                         const commRef = db.collection('partner_commissions').doc();
                         const availableAt = new Date();
                         availableAt.setDate(availableAt.getDate() + 30);

                         transaction.set(commRef, {
                            partnerId: pData.id,
                            referredUserId: organizerId,
                            registrationId: regRef.id,
                            orderId: orderId,
                            eventId: item.eventId,
                            eventTitle: item.eventTitle,
                            buyerName: orderData.userName,
                            ticketPrice: item.price,
                            amount: commissionValue,
                            status: "PENDENTE",
                            availableAt: admin.firestore.Timestamp.fromDate(availableAt),
                            createdAt: admin.firestore.FieldValue.serverTimestamp()
                         });

                         transaction.update(partnerRef, {
                            "stats.pendingBalance": admin.firestore.FieldValue.increment(commissionValue),
                            "stats.totalEarned": admin.firestore.FieldValue.increment(commissionValue),
                            "stats.salesCount": admin.firestore.FieldValue.increment(1),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                         });
                      }
                   }
                }

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
            }
            
            transaction.update(orderRef, { 
              status: 'paid', 
              stripePaymentIntentId: session.payment_intent,
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
            for (const d of regsSnap.docs) {
              transaction.update(d.ref, {
                status: 'refunded',
                paymentStatus: 'Estornado (Stripe)',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });

              const commsSnap = await db.collection("partner_commissions").where("registrationId", "==", d.id).where("status", "==", "PENDENTE").get();
              for (const cDoc of commsSnap.docs) {
                 const cData = cDoc.data();
                 transaction.update(cDoc.ref, { status: 'CANCELADO', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                 
                 const pRef = db.collection('partners').doc(cData.partnerId);
                 transaction.update(pRef, {
                    "stats.pendingBalance": admin.firestore.FieldValue.increment(-cData.amount),
                    "stats.totalEarned": admin.firestore.FieldValue.increment(-cData.amount),
                    "stats.salesCount": admin.firestore.FieldValue.increment(-1),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                 });
              }
            }
          }
          break;
        }

        case 'account.updated': {
          const account = event.data.object as Stripe.Account;
          const orgId = account.metadata?.orgId;
          if (orgId) {
            const isVerified = account.charges_enabled && account.payouts_enabled;
            transaction.update(db.collection('organizations').doc(orgId), {
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

      transaction.set(eventLogRef, {
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        type: event.type
      });
    });

    return NextResponse.json({ received: true });
  } catch (error: any) {
    if (error.message === "ALREADY_PROCESSED") {
      return NextResponse.json({ received: true, reason: 'event_already_processed' });
    }
    console.error(`[Stripe Webhook Error] Process Failure: ${error.message}`);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
