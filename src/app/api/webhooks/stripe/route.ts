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

/**
 * Webhook de Fulfillment Consolidado (Etapa 4 - Experiências)
 * Processa a baixa de estoque atômica para Eventos e Experience Slots.
 */
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

            for (const item of items) {
              const isExp = item.productType === 'experience';
              
              // 1. BAIXA DE ESTOQUE ATÔMICA
              if (isExp && item.occurrenceId) {
                // Decremento no Slot da Experiência
                const slotRef = db.collection("experiences").doc(item.eventId).collection("slots").doc(item.occurrenceId);
                transaction.update(slotRef, {
                  sold: admin.firestore.FieldValue.increment(item.quantity),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
              } else {
                // Fluxo padrão de Eventos
                const eventRef = db.collection("events").doc(item.eventId);
                transaction.update(eventRef, { 
                  ingressosVendidos: admin.firestore.FieldValue.increment(item.quantity),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                if (item.occurrenceId) {
                  const occRef = db.collection("recurring_occurrences").doc(item.occurrenceId);
                  transaction.update(occRef, {
                    ingressosVendidos: admin.firestore.FieldValue.increment(item.quantity),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                  });
                }
              }

              // 2. GERAÇÃO DE VOUCHERS (REGISTRATIONS)
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
                  productType: item.productType || 'event',
                  confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  timestamp: admin.firestore.FieldValue.serverTimestamp()
                };

                transaction.set(regRef, regData);

                // Envio de E-mail Assíncrono
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
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}