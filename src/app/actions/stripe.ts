
'use server';

import { headers } from 'next/headers';
import Stripe from 'stripe';
import { doc, getDoc, getFirestore, runTransaction, serverTimestamp, increment, collection } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { logSystemError } from '@/lib/error-manager';
import { calculateVibyOfficialSplit, toCents } from '@/lib/financial-utils';
import { generateUniqueTicketCode } from '@/lib/ticket-utils';

async function getFirebaseComponents() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const db = getFirestore(app);
  return { db };
}

async function getStripeInstance(db: any) {
  const snap = await getDoc(doc(db, 'settings', 'stripe'));
  if (!snap.exists()) throw new Error('Configurações do Stripe não localizadas.');
  const data = snap.data();
  const secretKey = data?.secretKey?.trim();
  if (!secretKey) throw new Error('Secret Key do Stripe ausente.');
  return new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' as any });
}

/**
 * Cria sessão de checkout para reserva de ingressos
 */
export async function createCheckoutSession(data: any) {
  try {
    const { db } = await getFirebaseComponents();
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

    if (destinationStripeAccount && totalApplicationFeeCents > 0) {
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

/**
 * Finaliza a sessão de checkout gerando os ingressos (Idempotente)
 */
export async function finalizeCheckoutSession(sessionId: string) {
  try {
    const { db } = await getFirebaseComponents();
    const stripe = await getStripeInstance(db);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return { success: false, error: 'O pagamento não foi aprovado.' };
    }

    const metadata = session.metadata;
    if (!metadata) return { success: false, error: 'Sessão inválida.' };

    return await runTransaction(db, async (transaction) => {
      if (metadata.type === 'order_checkout' && metadata.orderId) {
        const orderRef = doc(db, "orders", metadata.orderId);
        const orderSnap = await transaction.get(orderRef);
        
        if (!orderSnap.exists()) throw new Error("Pedido não localizado.");
        
        const orderData = orderSnap.data()!;
        // IDEMPOTÊNCIA: Se o pedido já está pago, não gera novos ingressos
        if (orderData.status === 'paid') return { success: true, alreadyProcessed: true };

        const userId = metadata.userId;
        const items = orderData.items || [];

        for (const item of items) {
          const targetRef = item.occurrenceId ? doc(db, "recurring_occurrences", item.occurrenceId) : doc(db, "events", item.eventId);
          
          transaction.update(targetRef, { 
            ingressosVendidos: increment(item.quantity),
            updatedAt: serverTimestamp()
          });

          if (item.occurrenceId) {
             transaction.update(doc(db, "events", item.eventId), {
               ingressosVendidos: increment(item.quantity),
               updatedAt: serverTimestamp()
             });
          }

          for (let j = 0; j < item.quantity; j++) {
            // GERAR CÓDIGO ÚNICO DE 16 DÍGITOS NO FORMATO XXXX-XXXX-XXXX-XXXX
            const ticketCode = await generateUniqueTicketCode(db);
            const regRef = doc(collection(db, "registrations"));
            
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
              price: item.financials.customerFinalPrice,
              administrativeFeeAmount: item.financials.administrativeFeeAmount,
              producerFeeAmount: item.financials.producerFeeAmount,
              producerNetAmount: item.financials.producerNetAmount,
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
              confirmedAt: serverTimestamp(),
              createdAt: serverTimestamp(),
              timestamp: serverTimestamp()
            });
          }
        }

        transaction.update(orderRef, { status: 'paid', stripeSessionId: sessionId, updatedAt: serverTimestamp() });
        return { success: true };
      }

      return { success: false, error: 'Sessão não identificada.' };
    });
  } catch (error: any) {
    console.error("[Checkout Finalization Error]", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Cria sessão de checkout para recarga de saldo Ads
 */
export async function createAdBalanceTopUpSession(data: {
  orgId: string;
  orgName: string;
  userEmail: string;
  baseAmount: number;
  transactionId: string;
}) {
  try {
    const { db } = await getFirebaseComponents();
    const head = await headers();
    const origin = head.get('origin') || 'https://viby.club';
    const stripe = await getStripeInstance(db);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `Recarga de Saldo Ads - ${data.orgName}`,
              description: 'Crédito exclusivo para impulsionamento de eventos na Viby Club',
            },
            unit_amount: Math.round(data.baseAmount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: data.userEmail,
      success_url: `${origin}/dashboard/organizacoes/${data.orgId}/finance?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${origin}/dashboard/organizacoes/${data.orgId}/finance?cancel=true`,
      metadata: {
        type: 'ad_topup',
        orgId: data.orgId,
        baseAmount: data.baseAmount.toString(),
        transactionId: data.transactionId
      },
    });

    return { success: true, url: session.url };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Finaliza a recarga de saldo Ads
 */
export async function finalizeAdTopUpSession(sessionId: string) {
  try {
    const { db } = await getFirebaseComponents();
    const stripe = await getStripeInstance(db);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') throw new Error("Pagamento não aprovado.");

    const metadata = session.metadata;
    if (metadata?.type !== 'ad_topup') throw new Error("Sessão inválida.");

    const amount = parseFloat(metadata.baseAmount);
    const orgId = metadata.orgId;

    await runTransaction(db, async (transaction) => {
      const orgRef = doc(db, "organizations", orgId);
      transaction.update(orgRef, {
        adBalance: increment(amount),
        updatedAt: serverTimestamp()
      });

      const txRef = doc(collection(db, "organizations", orgId, "transactions"));
      transaction.set(txRef, {
        type: 'ad_topup',
        amount,
        status: 'completed',
        stripeSessionId: sessionId,
        description: 'Recarga de Saldo Ads via Cartão',
        createdAt: serverTimestamp()
      });
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
