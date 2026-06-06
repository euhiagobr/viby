
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';

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
    
    event = webhookSecret 
      ? stripe.webhooks.constructEvent(payload, sig, webhookSecret)
      : JSON.parse(payload);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.metadata?.type === 'order_checkout' && session.metadata?.orderId) {
          const orderId = session.metadata.orderId;
          const orderRef = db.collection("orders").doc(orderId);
          const orderSnap = await orderRef.get();
          
          if (orderSnap.exists && orderSnap.data()?.status !== 'paid') {
            await db.runTransaction(async (transaction) => {
              const orderData = orderSnap.data()!;
              const userId = session.metadata!.userId;
              const items = orderData.items || [];
              const exchangeData = orderData.exchangeData || { rate: 1, date: new Date().toISOString().slice(0, 10) };

              for (const item of items) {
                const targetRef = item.occurrenceId 
                  ? db.collection("recurring_occurrences").doc(item.occurrenceId) 
                  : db.collection("events").doc(item.eventId);
                
                transaction.update(targetRef, { 
                  ingressosVendidos: admin.firestore.FieldValue.increment(item.quantity),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                for (let j = 0; j < item.quantity; j++) {
                  const ticketCode = Math.random().toString(36).substring(2, 10).toUpperCase();
                  const regRef = db.collection("registrations").doc();
                  
                  // Congelamento de Valores em BRL na data da venda
                  const priceBRL = Number((item.financials?.customerFinalPrice || item.price) * exchangeData.rate);

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
                    currency: item.currency || 'BRL',
                    // Dados Históricos de Câmbio
                    exchangeRate: exchangeData.rate,
                    exchangeDate: exchangeData.date,
                    priceBRL: priceBRL,
                    administrativeFeeAmount: item.financials?.administrativeFeeAmount || 0,
                    producerFeeAmount: item.financials?.producerFeeAmount || 0,
                    producerNetAmount: item.financials?.producerNetAmount || item.price,
                    ticketTypeName: item.ticketTypeName,
                    batchName: item.batchName,
                    paymentStatus: "Pago",
                    status: "active",
                    ticketCode,
                    stripeSessionId: session.id,
                    orderId,
                    confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                  });
                }
              }
              transaction.update(orderRef, { status: 'paid', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            });
          }
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;
        if (paymentIntentId) {
          const regsSnap = await db.collection("registrations").where("paymentIntentId", "==", paymentIntentId).get();
          const batch = db.batch();
          regsSnap.forEach(regDoc => {
            batch.update(regDoc.ref, { 
              status: 'refunded', 
              paymentStatus: 'Estornado (Stripe)',
              updatedAt: admin.firestore.FieldValue.serverTimestamp() 
            });
          });
          await batch.commit();
        }
        break;
      }
    }
    return NextResponse.json({ received: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
