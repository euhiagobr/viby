
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
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

  // Referência do log de evento para Idempotência (Lock de Nível 1)
  const eventLogRef = db.collection('stripe_processed_events').doc(event.id);

  try {
    // MECANISMO ANTI-DUPLICIDADE: runTransaction garante atomicidade total
    await db.runTransaction(async (transaction) => {
      // 1. Verifica se o evento já foi processado (Proteção contra Race Condition)
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

            // BLOQUEIO: Se a ordem já estiver paga, aborta para não duplicar ingressos
            if (orderData.status === 'paid') {
              console.log(`[Stripe Webhook] Order ${orderId} already paid. Aborting transaction.`);
              return;
            }

            const userId = session.metadata!.userId;
            const items = orderData.items || [];
            const currency = (orderData.currency || 'BRL').toUpperCase();

            for (const item of items) {
              // Devolução de Capacidade / Incremento de Vendas
              const targetRef = item.occurrenceId 
                ? db.collection("recurring_occurrences").doc(item.occurrenceId) 
                : db.collection("events").doc(item.eventId);
              
              transaction.update(targetRef, { 
                ingressosVendidos: admin.firestore.FieldValue.increment(item.quantity),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });

              // Emissão dos Ingressos (Registrations)
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
                  confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  timestamp: admin.firestore.FieldValue.serverTimestamp()
                };

                transaction.set(regRef, regData);

                // Envio de E-mail (Async fora da transação, mas agendado pelo sucesso dela)
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
            
            // Marca ordem como paga
            transaction.update(orderRef, { 
              status: 'paid', 
              stripePaymentIntentId: session.payment_intent,
              updatedAt: admin.firestore.FieldValue.serverTimestamp() 
            });
          }
          break;
        }

        case 'payment_intent.payment_failed': {
          const intent = event.data.object as Stripe.PaymentIntent;
          const orderId = intent.metadata?.orderId;
          if (orderId) {
            transaction.update(db.collection("orders").doc(orderId), {
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
            const regsSnap = await getDocs(query(collection(db, "registrations"), where("stripePaymentIntentId", "==", paymentIntentId)));
            regsSnap.forEach(d => {
              transaction.update(d.ref, {
                status: 'refunded',
                paymentStatus: 'Estornado (Stripe)',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            });
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

      // REGISTRO FINAL DE IDEMPOTÊNCIA (Lock Pessimista)
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
