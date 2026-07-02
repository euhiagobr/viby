
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
  const emailsToSend: any[] = [];

  try {
    await db.runTransaction(async (transaction) => {
      const eventLogSnap = await transaction.get(eventLogRef);
      if (eventLogSnap.exists) throw new Error("ALREADY_PROCESSED");

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.metadata?.type === 'order_checkout' && session.metadata?.orderId) {
          const orderId = session.metadata.orderId;
          const orderRef = db.collection("orders").doc(orderId);
          const orderSnap = await transaction.get(orderRef);
          
          if (!orderSnap.exists) return;
          const orderData = orderSnap.data()!;
          if (orderData.status === 'paid') return;

          // Processamento de Cupom de Usuário
          const userCouponId = session.metadata.userCouponId || orderData.userCouponId;
          if (userCouponId) {
            const couponRef = db.collection('user_coupons').doc(userCouponId);
            const totalTickets = orderData.items.reduce((acc: number, i: any) => acc + (i.discountAmount > 0 ? i.quantity : 0), 0);
            if (totalTickets > 0) {
              transaction.update(couponRef, {
                uses: admin.firestore.FieldValue.increment(totalTickets),
                lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            }
          }

          const items = orderData.items || [];
          for (const item of items) {
            const sourceColl = item.productType === 'experience' ? "experiences" : "events";
            const eventRef = db.collection(sourceColl).doc(item.eventId);
            
            if (item.productType === 'experience' && item.occurrenceId) {
              const slotRef = db.collection("experiences").doc(item.eventId).collection("slots").doc(item.occurrenceId);
              transaction.update(slotRef, { sold: admin.firestore.FieldValue.increment(item.quantity) });
              transaction.update(eventRef, { salesCount: admin.firestore.FieldValue.increment(item.quantity) });
            } else {
              transaction.update(eventRef, { ingressosVendidos: admin.firestore.FieldValue.increment(item.quantity) });
            }

            for (let j = 0; j < item.quantity; j++) {
              const ticketCode = Math.random().toString(36).substring(2, 10).toUpperCase();
              const regRef = db.collection("registrations").doc();
              transaction.set(regRef, {
                ...item,
                userId: orderData.userId,
                userName: orderData.userName,
                userEmail: orderData.userEmail,
                paymentStatus: "Pago",
                status: "active",
                ticketCode,
                orderId,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
              });
            }
          }
          transaction.update(orderRef, { status: 'paid', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
      }
      transaction.set(eventLogRef, { processedAt: admin.firestore.FieldValue.serverTimestamp(), type: event.type });
    });

    return NextResponse.json({ received: true });
  } catch (error: any) {
    if (error.message === "ALREADY_PROCESSED") return NextResponse.json({ received: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
