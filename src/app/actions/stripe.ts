
'use server';

import { headers } from 'next/headers';
import Stripe from 'stripe';
import { doc, getDoc, getFirestore, runTransaction, serverTimestamp, increment, collection, query, where, getDocs, limit, setDoc, updateDoc } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { logSystemError } from '@/lib/error-manager';
import { calculateDetailedVibyBreakdown } from '@/lib/financial-utils';

/**
 * @fileOverview Server Actions do Stripe utilizando exclusivamente o Client SDK do Firebase.
 */

async function getFirebaseComponents() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const db = getFirestore(app);
  return { db };
}

async function getStripeInstance(db: any) {
  try {
    const snap = await getDoc(doc(db, 'settings', 'stripe'));
    if (!snap.exists()) throw new Error('Configurações do Stripe não localizadas.');
    const data = snap.data();
    const secretKey = data?.secretKey?.trim();
    if (!secretKey) throw new Error('Secret Key do Stripe ausente.');
    return new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' as any });
  } catch (e: any) {
    throw e;
  }
}

async function generateSecureStatementDescriptor(db: any, metadata: any): Promise<string> {
  let username = "INGRESSO";
  try {
    if (metadata.type === 'ad_balance_topup' && metadata.orgId) {
      const orgSnap = await getDoc(doc(db, "organizations", metadata.orgId));
      if (orgSnap.exists()) username = orgSnap.data()?.username || username;
    } else if (metadata.orderId) {
      const orderSnap = await getDoc(doc(db, "orders", metadata.orderId));
      if (orderSnap.exists()) {
        const orderData = orderSnap.data();
        const firstItem = orderData?.items?.[0];
        if (firstItem?.organizationId) {
          const orgSnap = await getDoc(doc(db, "organizations", firstItem.organizationId));
          if (orgSnap.exists()) username = orgSnap.data()?.username || username;
        }
      }
    }
  } catch (e) {}

  const cleanUsername = username.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 17); 
  return `VIBY*${cleanUsername || "INGRESSO"}`;
}

export async function createCheckoutSession(data: any) {
  try {
    const { db } = await getFirebaseComponents();
    const head = await headers();
    const origin = head.get('origin') || 'https://viby.club';
    const stripe = await getStripeInstance(db);
    const descriptor = await generateSecureStatementDescriptor(db, data.metadata);
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: data.lineItems || [{
        price_data: {
          currency: 'brl',
          product_data: { name: data.eventTitle || 'Ingresso Viby' },
          unit_amount: Math.round(data.totalAmount),
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: data.userEmail,
      success_url: `${origin}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelado`,
      metadata: data.metadata,
      payment_intent_data: { statement_descriptor: descriptor }
    });
    
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

export async function createAdBalanceTopUpSession(data: any) {
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

    const descriptor = await generateSecureStatementDescriptor(db, metadata);
    
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
      payment_intent_data: { statement_descriptor: descriptor }
    });
    
    return { success: true, url: session.url };
  } catch (error: any) {
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
      // --- CASO 1: RECARGA DE ADS ---
      if (metadata.type === 'ad_balance_topup') {
        const orgRef = doc(db, "organizations", metadata.orgId);
        const amountToCredit = parseFloat(metadata.baseAmount);
        const txRef = doc(db, "organizations", metadata.orgId, "transactions", metadata.transactionId);
        
        const txSnap = await transaction.get(txRef);
        if (txSnap.exists() && txSnap.data()?.status === 'completed') {
          return { success: true, alreadyProcessed: true };
        }

        transaction.update(orgRef, {
          adBalance: increment(amountToCredit),
          updatedAt: serverTimestamp()
        });

        transaction.update(txRef, {
          status: 'completed',
          updatedAt: serverTimestamp(),
          stripeSessionId: sessionId
        });

        return { success: true };
      }

      // --- CASO 2: PEDIDO DE INGRESSOS (ORDER CHECKOUT) ---
      if (metadata.type === 'order_checkout' && metadata.orderId) {
        const orderRef = doc(db, "orders", metadata.orderId);
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) throw new Error("Pedido não localizado.");
        
        const orderData = orderSnap.data()!;
        if (orderData.status === 'paid') return { success: true, alreadyProcessed: true };

        const userId = metadata.userId;
        const balanceUsed = parseFloat(metadata.balanceUsed || "0");

        const items = orderData.items || [];
        for (const item of items) {
          const targetRef = item.occurrenceId ? doc(db, "recurring_occurrences", item.occurrenceId) : doc(db, "events", item.eventId);
          const snap = await transaction.get(targetRef);
          if (!snap.exists()) throw new Error("Evento ou data indisponível.");
          
          const data = snap.data()!;
          const currentSold = data.ingressosVendidos || 0;
          const capacity = data.capacidadeMaxima || data.capacidadeTotal || 0;
          
          if (capacity > 0 && (currentSold + item.quantity > capacity)) {
             throw new Error("Lotação máxima atingida.");
          }

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

        if (balanceUsed > 0) {
          transaction.set(doc(db, "wallets", userId), { balance: increment(-balanceUsed), updatedAt: serverTimestamp() }, { merge: true });
          transaction.update(doc(db, "users", userId), { walletBalance: increment(-balanceUsed), updatedAt: serverTimestamp() });
          transaction.set(doc(collection(db, "wallet_transactions")), {
            userId, amount: balanceUsed, type: 'debit', reason: 'compra_ingresso', description: `Uso de saldo no pedido ${metadata.orderId}`, timestamp: serverTimestamp()
          });
        }

        const feesSnap = await transaction.get(doc(db, "settings", "fees"));
        const stripeSettingsSnap = await transaction.get(doc(db, "settings", "stripe"));
        const fees = feesSnap.exists() ? feesSnap.data() : {};
        const stripeS = stripeSettingsSnap.exists() ? stripeSettingsSnap.data() : {};

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          for (let j = 0; j < item.quantity; j++) {
            const ticketCode = Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
            const breakdown = calculateDetailedVibyBreakdown(item.price, 1, fees, stripeS, (i === 0 && j === 0));

            const regRef = doc(collection(db, "registrations"));
            transaction.set(regRef, {
              eventId: item.eventId, eventTitle: item.eventTitle, eventImage: item.eventImage || '', eventDate: item.eventDate, eventCity: item.eventCity, userId: userId, userName: orderData.userName, userEmail: orderData.userEmail, organizationId: item.organizationId, ticketBasePrice: item.price, price: item.financials.customerFinalPrice, administrativeFeeAmount: item.financials.administrativeFeeAmount, producerFeeAmount: item.financials.producerFeeAmount, producerNetAmount: item.financials.producerNetAmount, ticketTypeName: item.ticketTypeName, batchName: item.batchName, paymentStatus: "Pago", status: "Ativo", ticketCode, stripeSessionId: sessionId, orderId: metadata.orderId, occurrenceId: item.occurrenceId || null, confirmedAt: serverTimestamp(), timestamp: serverTimestamp()
            });

            transaction.set(doc(collection(db, "tax_tickets")), {
              registrationId: regRef.id, eventId: item.eventId, eventTitle: item.eventTitle, orgName: item.organizerUsername || "Viby Partner", buyerName: orderData.userName, totalFacePrice: item.price, vibyGrossProfit: breakdown.vibyGross, vibyNetProfit: breakdown.vibyNet, taxAmount: breakdown.imposto, stripeFeeAmount: breakdown.stripeFeeTotal, payoutToProducer: breakdown.payoutToProducer, monthKey: new Date().toISOString().slice(0, 7), nfStatus: 'pendente', timestamp: serverTimestamp()
            });
          }
        }

        transaction.update(orderRef, { status: 'paid', stripeSessionId: sessionId, updatedAt: serverTimestamp() });
        return { success: true };
      }

      // --- CASO 3: CHECKOUT LEGADO ---
      if (metadata.type === 'cart_checkout' && metadata.registrationIds) {
        const regIds = metadata.registrationIds.split(',');
        for (const rid of regIds) {
           transaction.update(doc(db, "registrations", rid), {
              paymentStatus: "Pago", confirmedAt: serverTimestamp(), updatedAt: serverTimestamp()
           });
        }
        return { success: true };
      }

      return { success: false, error: 'Sessão não identificada.' };
    });
  } catch (error: any) {
    console.error("[Checkout Finalization Error]", error.message);
    return { success: false, error: error.message };
  }
}
