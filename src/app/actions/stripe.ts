'use server';

import { headers } from 'next/headers';
import Stripe from 'stripe';
import { db } from '@/firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logSystemError } from '@/lib/error-manager';
import { calculateDetailedVibyBreakdown } from '@/lib/financial-utils';

/**
 * @fileOverview Server Actions do Stripe com inicialização dinâmica e segura.
 * Implementa a finalização de pedidos via Admin SDK para garantir integridade.
 * O Statement Descriptor é gerado exclusivamente no servidor.
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

/**
 * Gera um Statement Descriptor (descritor de fatura) seguro e sanitizado.
 * Busca o username oficial da organização no banco de dados.
 * Ignora completamente qualquer username enviado pelo frontend.
 */
async function generateSecureStatementDescriptor(metadata: any): Promise<string> {
  const adminDb = getAdminDb();
  let username = "INGRESSO";

  try {
    // Caso 1: Recarga de Saldo Ads (identificado por orgId)
    if (metadata.type === 'ad_balance_topup' && metadata.orgId) {
      const orgSnap = await adminDb.collection("organizations").doc(metadata.orgId).get();
      if (orgSnap.exists) {
        username = orgSnap.data()?.username || username;
      }
    } 
    // Caso 2: Checkout de Pedido (identificado por orderId)
    else if (metadata.orderId) {
      const orderSnap = await adminDb.collection("orders").doc(metadata.orderId).get();
      if (orderSnap.exists) {
        const orderData = orderSnap.data();
        const firstItem = orderData?.items?.[0];
        if (firstItem?.organizationId) {
          const orgSnap = await adminDb.collection("organizations").doc(firstItem.organizationId).get();
          if (orgSnap.exists) {
            username = orgSnap.data()?.username || username;
          }
        }
      }
    }
    // Caso 3: Checkout de Carrinho (Legado/Fallback por registrationId)
    else if (metadata.registrationIds) {
      const firstRegId = metadata.registrationIds.split(',')[0];
      const regSnap = await adminDb.collection("registrations").doc(firstRegId).get();
      if (regSnap.exists) {
        const orgId = regSnap.data()?.organizationId;
        if (orgId) {
          const orgSnap = await adminDb.collection("organizations").doc(orgId).get();
          if (orgSnap.exists) {
            username = orgSnap.data()?.username || username;
          }
        }
      }
    }
  } catch (e) {
    console.error("[Descriptor Resolution Failure] Falling back to default.");
  }

  // Sanitização compatível com Stripe: Alfanumérico, Maiúsculo, Sem Acentos.
  // Limite de 22 caracteres. "VIBY*" ocupa 5.
  const cleanUsername = username
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") 
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "") 
    .substring(0, 17); 

  return `VIBY*${cleanUsername || "INGRESSO"}`;
}

export async function createCheckoutSession(data: any) {
  try {
    const head = await headers();
    const origin = head.get('origin') || 'https://viby.club';
    
    const stripe = await getStripeInstance();
    
    // Gera o descritor de forma segura ignorando inputs textuais do cliente
    const descriptor = await generateSecureStatementDescriptor(data.metadata);
    
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
      payment_intent_data: {
        statement_descriptor: descriptor
      }
    });
    
    return { success: true, url: session.url };
  } catch (error: any) {
    const errorCode = await logSystemError({
      error: { message: error.message, stack: error.stack },
      type: 'stripe_checkout_failure',
      severity: 'error',
      metadata: { orderId: data.metadata?.orderId }
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
    const metadata = { 
      type: 'ad_balance_topup', 
      orgId: data.orgId, 
      baseAmount: data.baseAmount.toString(), 
      transactionId: data.transactionId 
    };

    const descriptor = await generateSecureStatementDescriptor(metadata);
    
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
      payment_intent_data: {
        statement_descriptor: descriptor
      }
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
 */
export async function finalizeCheckoutSession(sessionId: string) {
  try {
    const adminDb = getAdminDb();
    const stripe = await getStripeInstance();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return { success: false, error: 'O pagamento não foi aprovado.' };
    }

    const metadata = session.metadata;
    if (!metadata) return { success: false, error: 'Sessão inválida.' };

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
        if (!orderSnap.exists) throw new Error("Pedido não localizado.");
        
        const orderData = orderSnap.data()!;
        if (orderData.status === 'paid') {
          return { success: true, alreadyProcessed: true };
        }

        const userId = metadata.userId;
        const balanceUsed = parseFloat(metadata.balanceUsed || "0");

        // 1. Validar e Reservar Capacidade (Atômico)
        const items = orderData.items || [];
        for (const item of items) {
          const targetRef = item.occurrenceId 
            ? adminDb.collection("recurring_occurrences").doc(item.occurrenceId) 
            : adminDb.collection("events").doc(item.eventId);
          
          const snap = await transaction.get(targetRef);
          if (!snap.exists) throw new Error("Evento ou data indisponível.");
          
          const data = snap.data()!;
          const currentSold = data.ingressosVendidos || 0;
          const capacity = data.capacidadeMaxima || data.capacidadeTotal || 0;
          
          if (capacity > 0 && (currentSold + item.quantity > capacity)) {
             throw new Error("Lotação máxima atingida durante o pagamento.");
          }

          transaction.update(targetRef, { 
            ingressosVendidos: FieldValue.increment(item.quantity),
            updatedAt: FieldValue.serverTimestamp()
          });

          // Sincronizar com evento pai se for ocorrência
          if (item.occurrenceId) {
            const parentRef = adminDb.collection("events").doc(item.eventId);
            transaction.update(parentRef, {
              ingressosVendidos: FieldValue.increment(item.quantity),
              updatedAt: serverTimestamp()
            });
          }
        }

        // 2. Processar Saldo da Carteira
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

          transaction.set(adminDb.collection("wallet_transactions").doc(), {
            userId,
            amount: balanceUsed,
            type: 'debit',
            reason: 'compra_ingresso',
            description: `Uso de saldo no pedido ${metadata.orderId}`,
            timestamp: FieldValue.serverTimestamp()
          });
        }

        // 3. Configurações Fiscais e Emissão
        const feesSnap = await transaction.get(adminDb.collection("settings").doc("fees"));
        const stripeSettingsSnap = await transaction.get(adminDb.collection("settings").doc("stripe"));
        const fees = feesSnap.exists ? feesSnap.data() : {};
        const stripeSettings = stripeSettingsSnap.exists ? stripeSettingsSnap.data() : {};

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          for (let j = 0; j < item.quantity; j++) {
            const ticketCode = Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
            const breakdown = calculateDetailedVibyBreakdown(
              item.price, 1, fees, stripeSettings, (i === 0 && j === 0)
            );

            const regRef = adminDb.collection("registrations").doc();
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
              status: "Ativo",
              ticketCode,
              stripeSessionId: sessionId,
              orderId: metadata.orderId,
              occurrenceId: item.occurrenceId || null,
              confirmedAt: FieldValue.serverTimestamp(),
              timestamp: FieldValue.serverTimestamp()
            });

            // Registro ERP
            transaction.set(adminDb.collection("tax_tickets").doc(), {
              registrationId: regRef.id,
              eventId: item.eventId,
              eventTitle: item.eventTitle,
              orgName: item.organizerUsername || "Viby Partner",
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

    return { success: false, error: 'Sessão não identificada.' };
  } catch (error: any) {
    console.error("[Checkout Finalization Error]", error);
    return { success: false, error: error.message };
  }
}
