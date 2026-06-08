
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

                // Lógica de Comissão de Afiliado
                const orgRef = db.collection("organizations").doc(item.organizationId);
                const orgSnap = await transaction.get(orgRef);
                const regIds: string[] = [];

                if (orgSnap.exists) {
                  const org = orgSnap.data()!;
                  const now = new Date();
                  const affStart = org.affiliateStartDate ? new Date(org.affiliateStartDate) : null;
                  const affEnd = org.affiliateEndDate ? new Date(org.affiliateEndDate) : null;

                  const isAffiliateActive = org.affiliateUserId && 
                    (!affStart || now >= affStart) && 
                    (!affEnd || now <= affEnd);

                  for (let j = 0; j < item.quantity; j++) {
                    const ticketCode = Math.random().toString(36).substring(2, 10).toUpperCase();
                    const regRef = db.collection("registrations").doc();
                    regIds.push(regRef.id);
                    
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

                  if (isAffiliateActive) {
                    const affCodeSnap = await transaction.get(db.collection("affiliateCodes").doc(org.affiliateCode));
                    if (affCodeSnap.exists) {
                      const affCodeData = affCodeSnap.data()!;
                      const commissionValue = affCodeData.commissionValue || 0;
                      const totalCommission = commissionValue * item.quantity;

                      const commRef = db.collection("affiliateCommissions").doc();
                      transaction.set(commRef, {
                        affiliateUserId: org.affiliateUserId,
                        affiliateCode: org.affiliateCode,
                        organizationId: item.organizationId,
                        eventId: item.eventId,
                        orderId,
                        registrationIds: regIds,
                        quantity: item.quantity,
                        commissionPerTicket: commissionValue,
                        totalCommission,
                        status: 'pending',
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                      });
                    }
                  }
                }
              }
              transaction.update(orderRef, { status: 'paid', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            });
          }
        }
        
        if (session.metadata?.type === 'ad_topup' && session.metadata?.orgId) {
          const { orgId, baseAmount, couponCode, totalToPay } = session.metadata;
          const amount = parseFloat(baseAmount);
          const orgRef = db.collection("organizations").doc(orgId);
          
          await db.runTransaction(async (transaction) => {
            const orgSnap = await transaction.get(orgRef);
            if (orgSnap.exists) {
              transaction.update(orgRef, {
                adBalance: admin.firestore.FieldValue.increment(amount),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
              
              const txRef = orgRef.collection("transactions").doc();
              transaction.set(txRef, {
                type: 'ad_topup',
                amount: amount,
                totalCharged: parseFloat(totalToPay),
                status: 'completed',
                couponCode: couponCode || null,
                stripeSessionId: session.id,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
              });

              const taxRef = db.collection("tax_ads").doc();
              transaction.set(taxRef, {
                orgId,
                orgName: orgSnap.data()?.name || 'Marca',
                adTitle: 'Recarga Saldo Ads',
                grossValue: amount,
                netValue: amount,
                taxValue: Number((amount * 0.11).toFixed(2)),
                nfStatus: 'pendente',
                status: 'ativo',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
              });

              if (couponCode) {
                 const couponQ = await db.collection("ad_coupons").where("code", "==", couponCode).limit(1).get();
                 if (!couponQ.empty) {
                    transaction.update(couponQ.docs[0].ref, {
                       currentUses: admin.firestore.FieldValue.increment(1),
                       updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                 }
              }
            }
          });
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
    console.error("[Stripe Webhook Error]", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
