
'use server';

import { headers } from 'next/headers';
import Stripe from 'stripe';
import { db } from '@/firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logSystemError } from '@/lib/error-manager';
import { calculateDetailedVibyBreakdown } from '@/lib/financial-utils';
import { sendTicketEmail } from './email';

/**
 * @fileOverview Server Actions do Stripe com inicialização dinâmica e segura.
 * Implementa a finalização de pedidos via Admin SDK para garantir integridade.
 */

async function getStripeInstance() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'stripe'));
    
    if (!snap.exists()) {
      throw new Error('Configurações do Stripe não localizadas no banco.');
    }

    const data = snap.data();
    const secretKey = data?.secretKey?.trim();

    if (!secretKey) throw new Error('Secret Key do Stripe ausente.');

    return new Stripe(secretKey, {
      apiVersion: '2024-12-18.acacia' as any,
    });
  } catch (e: any) {
    console.error("[Stripe Init Error]", e.message);
    throw e;
  }
}

export async function createCheckoutSession(data: any) {
  try {
    const head = await headers();
    const origin = head.get('origin') || 'https://viby.club';
    
    const stripe = await getStripeInstance();
    
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
    });
    
    return { success: true, url: session.url };
  } catch (error: any) {
    const errorCode = await logSystemError({
      error: { message: error.message, stack: error.stack },
      type: 'stripe_checkout_failure',
      severity: 'error',
      metadata: { items: data.metadata?.registrationIds }
    });
    return { success: false, error: error.message, code: errorCode };
  }
}

export async function createAdBalanceTopUpSession(data: any) {
  try {
    const head = await headers();
    const origin = head.get('origin') || 'https://viby.club';
    const stripe = await getStripeInstance();
    
    const amountToCharge = data.baseAmount * 1.21;
    
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
      metadata: { 
        type: 'ad_balance_topup', 
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

export async function getStripeSession(sessionId: string) {
  try {
    const stripe = await getStripeInstance();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return { 
      id: session.id, 
      payment_status: session.payment_status, 
      amount_total: session.amount_total, 
      metadata: session.metadata 
    };
  } catch (error: any) {
    return null;
  }
}

/**
 * Finaliza uma sessão de checkout de forma segura no servidor.
 * Implementa IDEMPOTÊNCIA verificando se o pedido já foi processado.
 */
export async function finalizeCheckoutSession(sessionId: string) {
  try {
    const adminDb = getAdminDb();
    const stripe = await getStripeInstance();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return { success: false, error: 'O pagamento ainda não consta como aprovado no gateway.' };
    }

    const metadata = session.metadata;
    if (!metadata) return { success: false, error: 'Sessão inválida (metadados ausentes).' };

    // --- CASO 1: RECARGA DE ADS ---
    if (metadata.type === 'ad_balance_topup') {
      return await adminDb.runTransaction(async (transaction) => {
        const orgRef = adminDb.collection("organizations").doc(metadata.orgId);
        const amountToCredit = parseFloat(metadata.baseAmount);
        
        const txRef = adminDb.collection("organizations").doc(metadata.orgId).collection("transactions").doc(metadata.transactionId);
        const txSnap = await transaction.get(txRef);
        
        if (txSnap.exists && txSnap.data()?.status === 'completed') {
          return { success: true, alreadyProcessed: true };
        }

        transaction.update(orgRef, {
          adBalance: FieldValue.increment(amountToCredit),
          updatedAt: FieldValue.serverTimestamp()
        });

        transaction.update(txRef, {
          status: 'completed',
          updatedAt: FieldValue.serverTimestamp(),
          stripeSessionId: sessionId
        });

        return { success: true };
      });
    }

    // --- CASO 2: PEDIDO DE INGRESSOS (ORDER CHECKOUT) ---
    if (metadata.type === 'order_checkout' && metadata.orderId) {
      const orderRef = adminDb.collection("orders").doc(metadata.orderId);
      
      return await adminDb.runTransaction(async (transaction) => {
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) throw new Error("Pedido não localizado no banco.");
        
        const orderData = orderSnap.data()!;
        if (orderData.status === 'paid') {
          return { success: true, alreadyProcessed: true };
        }

        const userId = metadata.userId;
        const balanceUsed = parseFloat(metadata.balanceUsed || "0");

        // 1. Processar Saldo se utilizado
        if (balanceUsed > 0) {
          const walletRef = adminDb.collection("wallets").doc(userId);
          const userRef = adminDb.collection("users").doc(userId);
          
          transaction.set(walletRef, { 
            balance: FieldValue.increment(-balanceUsed), 
            updatedAt: FieldValue.serverTimestamp() 
          }, { merge: true });

          transaction.update(userRef, { 
            walletBalance: FieldValue.increment(-balanceUsed), 
            updatedAt: FieldValue.serverTimestamp() 
          });

          const wTxRef = adminDb.collection("wallet_transactions").doc();
          transaction.set(wTxRef, {
            userId,
            amount: balanceUsed,
            type: 'debit',
            reason: 'compra_ingresso',
            description: `Débito: Reserva ${metadata.orderId}`,
            timestamp: FieldValue.serverTimestamp()
          });
        }

        // 2. Configurações Fiscais
        const feesSnap = await transaction.get(adminDb.collection("settings").doc("fees"));
        const stripeSettingsSnap = await transaction.get(adminDb.collection("settings").doc("stripe"));
        const promosSnap = await transaction.get(adminDb.collection("settings").doc("promotions"));

        const fees = feesSnap.exists ? feesSnap.data() : {};
        const stripeSettings = stripeSettingsSnap.exists ? stripeSettingsSnap.data() : {};
        const promotions = promosSnap.exists ? promosSnap.data() : {};

        // 3. Emitir Ingressos (Registrations) e Registros Fiscais
        const items = orderData.items || [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          
          for (let j = 0; j < item.quantity; j++) {
            const ticketCode = Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
            const breakdown = calculateDetailedVibyBreakdown(
              item.price, 1, fees, stripeSettings, (i === 0 && j === 0), promotions
            );

            let fiscalTitle = item.eventTitle;
            let displayDate = "Data a confirmar";
            if (item.occurrenceId) {
               const dateStr = item.eventDate;
               displayDate = new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
               fiscalTitle = `${item.eventTitle} (${new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR')})`;
            }

            const regRef = adminDb.collection("registrations").doc();
            transaction.set(regRef, {
              eventId: item.eventId,
              eventTitle: fiscalTitle,
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
              status: "Ativo",
              ticketCode,
              stripeSessionId: sessionId,
              orderId: metadata.orderId,
              occurrenceId: item.occurrenceId || null,
              confirmedAt: FieldValue.serverTimestamp(),
              timestamp: FieldValue.serverTimestamp()
            });

            const taxRef = adminDb.collection("tax_tickets").doc();
            transaction.set(taxRef, {
              registrationId: regRef.id,
              eventId: item.eventId,
              eventTitle: fiscalTitle,
              orgName: item.organizerUsername || "Marca",
              buyerName: orderData.userName,
              totalFacePrice: item.price,
              vibyGrossProfit: breakdown.vibyGross,
              vibyNetProfit: breakdown.vibyNet,
              taxAmount: breakdown.imposto,
              stripeFeeAmount: breakdown.stripeFeeTotal,
              payoutToProducer: breakdown.payoutToProducer,
              monthKey: new Date().toISOString().slice(0, 7),
              nfStatus: 'pendente',
              timestamp: FieldValue.serverTimestamp()
            });

            if (item.occurrenceId) {
              const occRef = adminDb.collection("recurring_occurrences").doc(item.occurrenceId);
              transaction.update(occRef, { ingressosVendidos: FieldValue.increment(1) });
            }
            
            // Envio de E-mail (Nota: idealmente fora da transação, chamaremos após commit)
            // sendTicketEmail({...})
          }
        }

        transaction.update(orderRef, { 
          status: 'paid', 
          stripeSessionId: sessionId, 
          updatedAt: FieldValue.serverTimestamp() 
        });

        return { success: true };
      });
    }

    return { success: false, error: 'Tipo de transação desconhecido.' };
  } catch (error: any) {
    console.error("[Checkout Finalization Error]", error);
    return { success: false, error: error.message };
  }
}
