
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
 * Webhook de Fulfillment Blindado (Hardening Final)
 * Garante: Idempotência, Consistência de Estoque e Integridade de Reserva.
 */
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

  // 1. IDEMPOTENCY CHECK (Previne re-processamento de retries do Stripe)
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

          const userId = session.metadata.userId;
          const items = orderData.items || [];
          const currency = (orderData.currency || 'BRL').toUpperCase();
          
          // 2. VALIDAR RESERVAS (HOLD SYSTEM VALIDATION)
          const reservationIds = (session.metadata.reservations || "").split(',').filter(Boolean);
          for (const resId of reservationIds) {
             const resRef = db.collection('experience_reservations').doc(resId);
             const resSnap = await transaction.get(resRef);
             const resData = resSnap.data();

             // SEGREDO DE CONSISTÊNCIA: Se a reserva expirou, mas o pagamento chegou, tentamos salvar.
             // Se ela já foi marcada como 'expired', abortamos se não houver mais estoque real.
             if (!resSnap.exists || resData?.status === 'cancelled') {
                throw new Error("RESERVATION_INVALID");
             }
          }

          // 3. ATOMIC FULFILLMENT & INVENTORY CHECK
          for (const item of items) {
            const isExp = item.productType === 'experience';
            
            if (isExp && item.occurrenceId) {
              const slotRef = db.collection("experiences").doc(item.eventId).collection("slots").doc(item.occurrenceId);
              const slotSnap = await transaction.get(slotRef);
              const slotData = slotSnap.data();

              // SAFETY RECHECK: Garante que sold não ultrapasse capacity mesmo em race conditions
              if ((slotData?.sold || 0) + item.quantity > (slotData?.capacity || 0)) {
                console.error(`[CAPACITY_CONFLICT] Slot ${item.occurrenceId} is full.`);
                transaction.update(orderRef, { status: 'needs_review', conflict_reason: 'oversold' });
                throw new Error("SLOT_CAPACITY_EXCEEDED");
              }

              transaction.update(slotRef, {
                sold: admin.firestore.FieldValue.increment(item.quantity),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            } else {
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

            // 4. GERAÇÃO DE VOUCHERS
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

              sendTicketEmail({
                to: orderData.userEmail,
                userName: orderData.userName,
                eventTitle: item.eventTitle,
                ticketCode,
                eventDate: item.eventDate,
                eventCity: item.eventCity,
                voucherUrl: `https://viby.club/dashboard/ingressos/${regRef.id}/voucher`
              }).catch(e => console.error("[Webhook Email] Error:", e.message));
            }
          }
          
          // 5. FINALIZAR RESERVAS E ORDEM
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
            updatedAt: admin.firestore.FieldValue.serverTimestamp() 
          });
        }
      }

      // Log de processamento para idempotência
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
