'use server';

import { headers } from 'next/headers';
import Stripe from 'stripe';
import { doc, getDoc, getFirestore, runTransaction, serverTimestamp, increment, collection, setDoc, updateDoc } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { logSystemError } from '@/lib/error-manager';
import { calculateVibyOfficialSplit, toCents } from '@/lib/financial-utils';

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

export async function createCheckoutSession(data: any) {
  try {
    const { db } = await getFirebaseComponents();
    const head = await headers();
    const origin = head.get('origin') || 'https://viby.club';
    const stripe = await getStripeInstance(db);

    const { metadata, userEmail, lineItems, totalApplicationFeeCents, destinationStripeAccount } = data;

    // Configuração base da sessão
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: userEmail,
      success_url: `${origin}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelado`,
      metadata: metadata,
    };

    // IMPLEMENTAÇÃO DESTINATION CHARGES (SPLIT AUTOMÁTICO)
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
      // --- CASO 1: PEDIDO DE INGRESSOS (ORDER CHECKOUT) ---
      if (metadata.type === 'order_checkout' && metadata.orderId) {
        const orderRef = doc(db, "orders", metadata.orderId);
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) throw new Error("Pedido não localizado.");
        
        const orderData = orderSnap.data()!;
        if (orderData.status === 'paid') return { success: true, alreadyProcessed: true };

        const userId = metadata.userId;
        const items = orderData.items || [];

        // Atualizar estoque e criar registros
        for (const item of items) {
          const targetRef = item.occurrenceId ? doc(db, "recurring_occurrences", item.occurrenceId) : doc(db, "events", item.eventId);
          const snap = await transaction.get(targetRef);
          if (snap.exists()) {
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
          }

          // Criar registros de ingressos nominais
          for (let j = 0; j < item.quantity; j++) {
            const ticketCode = Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
            const regRef = doc(collection(db, "registrations"));
            
            // Note: Não somamos mais ao walletBalance do organizador pois o Stripe Connect já fez o repasse
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
              payoutMode: "stripe_connect", // Marca que o repasse foi automático
              status: "Ativo",
              ticketCode,
              stripeSessionId: sessionId,
              orderId: metadata.orderId,
              occurrenceId: item.occurrenceId || null,
              confirmedAt: serverTimestamp(),
              timestamp: serverTimestamp()
            });
          }
        }

        transaction.update(orderRef, { status: 'paid', stripeSessionId: sessionId, updatedAt: serverTimestamp() });
        return { success: true };
      }

      return { success: false, error: 'Sessão não identificada ou processada.' };
    });
  } catch (error: any) {
    console.error("[Checkout Finalization Error]", error.message);
    return { success: false, error: error.message };
  }
}

export async function createAdBalanceTopUpSession(data: any) {
  // Mantido para recarga de saldo de anúncios (Viby retém 100% e libera crédito interno)
  try {
    const { db } = await getFirebaseComponents();
    const head = await headers();
    const origin = head.get('origin') || 'https://viby.club';
    const stripe = await getStripeInstance(db);
    
    const amountToCharge = data.baseAmount * 1.21;
    const metadata = { 
      type: 'ad_balance_topup', 
      orgId: data.orgId, 
      baseAmount: data.baseAmount.toString(), 
      transactionId: data.transactionId 
    };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { 
            name: `Recarga Ads - ${data.orgName}`,
            description: `Crédito de R$ ${data.baseAmount} + Encargos Fiscais (21%)`
          },
          unit_amount: Math.round(amountToCharge * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: data.userEmail,
      success_url: `${origin}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelado`,
      metadata: metadata,
      payment_intent_data: { statement_descriptor: 'VIBY*ADS' }
    });
    
    return { success: true, url: session.url };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
