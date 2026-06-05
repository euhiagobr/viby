
'use server';

import { headers } from 'next/headers';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { logSystemError } from '@/lib/error-manager';
import { calculateVibyOfficialSplit, toCents, formatCurrency } from '@/lib/financial-utils';
import { generateUniqueTicketCode } from '@/lib/ticket-utils';
import { sendTicketEmail } from '@/app/actions/email';

async function getStripeInstance(db: admin.firestore.Firestore) {
  const snap = await db.collection('settings').doc('stripe').get();
  if (!snap.exists) throw new Error('Configurações do Stripe não localizadas.');
  const data = snap.data();
  const secretKey = data?.secretKey?.trim();
  if (!secretKey) throw new Error('Secret Key do Stripe ausente.');
  return new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' as any });
}

export async function createCheckoutSession(data: any) {
  try {
    const db = getAdminDb();
    const head = await headers();
    const origin = head.get('origin') || 'https://viby.club';
    const stripe = await getStripeInstance(db);

    const { metadata, userEmail, lineItems, totalApplicationFeeCents, destinationStripeAccount } = data;

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: userEmail,
      success_url: `${origin}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelado`,
      metadata: metadata,
    };

    if (destinationStripeAccount) {
      sessionConfig.payment_intent_data = {
        application_fee_amount: totalApplicationFeeCents,
        transfer_data: {
          destination: destinationStripeAccount,
        },
        statement_descriptor: 'VIBY*INGRESSOS',
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    return { success: true, url: session.url };
  } catch (error: any) {
    await logSystemError({
      error: { message: error.message, stack: error.stack },
      type: 'stripe_checkout_failure',
      severity: 'error',
      metadata: { orderId: data.metadata?.orderId }
    });
    return { success: false, error: error.message };
  }
}

export async function finalizeCheckoutSession(sessionId: string) {
  try {
    const db = getAdminDb();
    const stripe = await getStripeInstance(db);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return { success: false, error: 'O pagamento não foi aprovado.' };
    }

    const metadata = session.metadata;
    if (!metadata) return { success: false, error: 'Sessão inválida.' };

    return await db.runTransaction(async (transaction) => {
      if (metadata.type === 'order_checkout' && metadata.orderId) {
        const orderRef = db.collection("orders").doc(metadata.orderId);
        const orderSnap = await transaction.get(orderRef);
        
        if (!orderSnap.exists) throw new Error("Pedido não localizado.");
        
        const orderData = orderSnap.data()!;
        if (orderData.status === 'paid') return { success: true, alreadyProcessed: true };

        const userId = metadata.userId;
        const items = orderData.items || [];

        for (const item of items) {
          const targetRef = item.occurrenceId 
            ? db.collection("recurring_occurrences").doc(item.occurrenceId) 
            : db.collection("events").doc(item.eventId);
          
          transaction.update(targetRef, { 
            ingressosVendidos: admin.firestore.FieldValue.increment(item.quantity),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // Atualiza contador de público na organização
          const orgRef = db.collection("organizations").doc(item.organizationId);
          transaction.update(orgRef, {
            totalAttendeesCount: admin.firestore.FieldValue.increment(item.quantity),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          if (item.occurrenceId) {
             transaction.update(db.collection("events").doc(item.eventId), {
               ingressosVendidos: admin.firestore.FieldValue.increment(item.quantity),
               updatedAt: admin.firestore.FieldValue.serverTimestamp()
             });
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
              price: item.financials?.customerFinalPrice || item.price,
              administrativeFeeAmount: item.financials?.administrativeFeeAmount || 0,
              producerFeeAmount: item.financials?.producerFeeAmount || 0,
              producerNetAmount: item.financials?.producerNetAmount || item.price,
              ticketTypeName: item.ticketTypeName,
              batchName: item.batchName,
              paymentStatus: "Pago",
              payoutMode: "stripe_connect",
              status: "active",
              ticketCode,
              stripeSessionId: sessionId,
              paymentIntentId: session.payment_intent,
              orderId: metadata.orderId,
              occurrenceId: item.occurrenceId || null,
              confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              timestamp: admin.firestore.FieldValue.serverTimestamp()
            };

            transaction.set(regRef, regData);

            const eventDateObj = item.eventDate?.toDate ? item.eventDate.toDate() : new Date(item.eventDate);
            sendTicketEmail({
              to: orderData.userEmail,
              userName: orderData.userName,
              eventTitle: item.eventTitle,
              ticketCode: ticketCode,
              eventDate: eventDateObj.toLocaleString('pt-BR'),
              voucherUrl: `https://viby.club/dashboard/ingressos/${regRef.id}/voucher`
            }).catch(e => console.warn("[Email-Webhook] Falha ao enviar voucher", e));
          }
        }

        transaction.update(orderRef, { 
          status: 'paid', 
          stripeSessionId: sessionId, 
          paymentIntentId: session.payment_intent,
          updatedAt: admin.firestore.FieldValue.serverTimestamp() 
        });

        return { success: true };
      }

      return { success: false, error: 'Sessão não identificada para fulfillment.' };
    });
  } catch (error: any) {
    console.error("[Webhook Fulfillment Error]", error.message);
    return { success: false, error: error.message };
  }
}

export async function createAdBalanceTopUpSession(data: any) {
  try {
    const db = getAdminDb();
    const head = await headers();
    const origin = head.get('origin') || 'https://viby.club';
    const stripe = await getStripeInstance(db);

    const { orgId, orgUsername, userEmail, userId, baseAmount, finalBalance, totalToPay, couponCode } = data;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: {
            name: `Recarga Saldo Ads - Viby`,
            description: `Crédito de ${formatCurrency(finalBalance)} para publicidade.`,
          },
          unit_amount: toCents(totalToPay),
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: userEmail,
      success_url: `${origin}/dashboard/organizacoes/${orgUsername}/finance?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${origin}/dashboard/organizacoes/${orgUsername}/finance`,
      metadata: {
        type: 'ad_topup',
        orgId,
        userId,
        finalBalance: finalBalance.toString(),
        couponCode: couponCode || "",
        baseAmount: baseAmount.toString()
      },
    });

    return { success: true, url: session.url };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function finalizeAdTopUpSession(sessionId: string) {
  const db = getAdminDb();
  try {
    const stripe = await getStripeInstance(db);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return { success: false, error: 'Pagamento pendente.' };
    }

    const m = session.metadata;
    if (m?.type !== 'ad_topup') return { success: false, error: 'Sessão inválida.' };

    const { orgId, finalBalance, couponCode, userId, baseAmount } = m;

    return await db.runTransaction(async (transaction) => {
      const orgRef = db.collection('organizations').doc(orgId);
      const orgSnap = await transaction.get(orgRef);
      if (!orgSnap.exists) throw new Error("Organização não encontrada para crédito.");

      const txId = `stripe_ad_${sessionId}`;
      const txRef = db.collection('organizations').doc(orgId).collection('transactions').doc(txId);
      const txSnap = await transaction.get(txRef);
      
      if (txSnap.exists) return { success: true, alreadyProcessed: true };

      // Incrementar saldo
      transaction.update(orgRef, {
        adBalance: admin.firestore.FieldValue.increment(parseFloat(finalBalance)),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Registrar transação
      transaction.set(txRef, {
        type: 'ad_topup',
        status: 'completed',
        amount: parseFloat(baseAmount),
        finalBalanceCredited: parseFloat(finalBalance),
        couponCode: couponCode || null,
        stripeSessionId: sessionId,
        userId: userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Auditoria Global
      const taxRef = db.collection('tax_ads').doc();
      transaction.set(taxRef, {
        adId: txId,
        orgId: orgId,
        orgName: orgSnap.data()?.name || "Org",
        grossValue: parseFloat(baseAmount),
        netValue: parseFloat(finalBalance),
        taxValue: 0, 
        status: 'completado',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Incrementar uso do cupom se existir
      if (couponCode) {
        const couponsSnap = await db.collection('ad_coupons').where('code', '==', couponCode).limit(1).get();
        if (!couponsSnap.empty) {
          transaction.update(couponsSnap.docs[0].ref, {
            currentUses: admin.firestore.FieldValue.increment(1)
          });
        }
      }

      return { success: true };
    });
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
