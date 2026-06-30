
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
    const webhookSecret = stripeSettingsSnap.data()?.webhookSecret;
    
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

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.metadata?.type === 'order_checkout' && session.metadata?.orderId) {
          const orderId = session.metadata.orderId;
          const orderRef = db.collection("orders").doc(orderId);
          const orderSnap = await transaction.get(orderRef);
          
          if (!orderSnap.exists) throw new Error("Order not found");
          const orderData = orderSnap.data()!;
          if (orderData.status === 'paid') return;

          // 1. LEITURA DE RESERVAS
          const reservationIds = (session.metadata.reservations || "").split(',').filter(Boolean);
          for (const resId of reservationIds) {
             const resRef = db.collection('experience_reservations').doc(resId);
             const resSnap = await transaction.get(resRef);
             if (!resSnap.exists || resSnap.data()?.status === 'cancelled') {
                throw new Error("RESERVATION_INVALID");
             }
          }

          // 2. LEITURA DE EVENTOS E SLOTS (Obrigatório antes de qualquer escrita no loop)
          const items = orderData.items || [];
          const itemSnapshots = [];
          
          for (const item of items) {
            const isExp = item.productType === 'experience';
            const sourceColl = isExp ? "experiences" : "events";
            const eventRef = db.collection(sourceColl).doc(item.eventId);
            const eventSnap = await transaction.get(eventRef);
            
            let slotSnap = null;
            if (isExp && item.occurrenceId) {
              const slotRef = db.collection("experiences").doc(item.eventId).collection("slots").doc(item.occurrenceId);
              slotSnap = await transaction.get(slotRef);
            }

            let occSnap = null;
            if (!isExp && item.occurrenceId) {
              const occRef = db.collection("recurring_occurrences").doc(item.occurrenceId);
              occSnap = await transaction.get(occRef);
            }

            itemSnapshots.push({ item, eventRef, eventSnap, slotSnap, occSnap });
          }

          // 3. BLOCO DE ESCRITA
          const userId = session.metadata.userId;
          const currency = (orderData.currency || 'BRL').toUpperCase();

          for (const snap of itemSnapshots) {
            const { item, eventRef, eventSnap, slotSnap, occSnap } = snap;
            const isExp = item.productType === 'experience';
            const eventInfo = eventSnap.data();

            if (isExp && item.occurrenceId && slotSnap) {
              const slotData = slotSnap.data();
              if ((slotData?.sold || 0) + item.quantity > (slotData?.capacity || 0)) {
                throw new Error("SLOT_CAPACITY_EXCEEDED");
              }
              transaction.update(slotSnap.ref, {
                sold: admin.firestore.FieldValue.increment(item.quantity),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            } else {
              transaction.update(eventRef, { 
                ingressosVendidos: admin.firestore.FieldValue.increment(item.quantity),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });

              if (item.occurrenceId && occSnap) {
                transaction.update(occSnap.ref, {
                  ingressosVendidos: admin.firestore.FieldValue.increment(item.quantity),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
              }
            }

            for (let j = 0; j < item.quantity; j++) {
              const ticketCode = Math.random().toString(36).substring(2, 10).toUpperCase();
              const regRef = db.collection("registrations").doc();
              
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
                orderId,
                occurrenceId: item.occurrenceId || null,
                productType: item.productType || 'event',
                confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                timestamp: admin.firestore.FieldValue.serverTimestamp()
              });

              await sendTicketEmail({
                to: orderData.userEmail,
                userName: orderData.userName,
                eventTitle: item.eventTitle,
                ticketCode,
                eventDate: new Date(item.eventDate).toLocaleString('pt-BR'),
                eventCity: item.eventCity,
                voucherUrl: `https://viby.club/dashboard/ingressos/${regRef.id}/voucher`,
                usagePolicy: eventInfo?.usagePolicy || "",
                additionalInfo: eventInfo?.additionalInfo || ""
              });
            }
          }
          
          for (const resId of reservationIds) {
            transaction.update(db.collection('experience_reservations').doc(resId), { 
              status: 'confirmed', 
              orderId,
              updatedAt: admin.firestore.FieldValue.serverTimestamp() 
            });
          }

          transaction.update(orderRef, { 
            status: 'paid', 
            stripePaymentIntentId: session.payment_intent,
            reconciled: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp() 
          });
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
      return NextResponse.json({ received: true, reason: 'duplicate_event_ignored' });
    }
    console.error("[WEBHOOK-ERROR-CRITICAL]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
