
'use server';

import Stripe from 'stripe';
import { doc, getDoc, getFirestore, writeBatch, serverTimestamp, collection, increment } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { logSystemError } from '@/lib/error-manager';
import { recordAuditLog } from './audit';

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

export type RefundType = 'shared' | 'platform_absorbed';

/**
 * Processa o estorno de um ingresso via Stripe Connect de forma atômica.
 */
export async function processStripeRefund(params: {
  registrationId: string;
  executorUid: string;
  role: 'admin' | 'organizer';
  refundType: RefundType;
}) {
  const { registrationId, executorUid, role, refundType } = params;
  const { db } = await getFirebaseComponents();

  try {
    const regRef = doc(db, 'registrations', registrationId);
    const regSnap = await getDoc(regRef);

    if (!regSnap.exists()) throw new Error('Ingresso não localizado.');
    const regData = regSnap.data();

    // Idempotência no Firestore
    if (regData.status === 'refunded' || regData.paymentStatus === 'Estornado') {
      return { success: true, message: 'Este ingresso já consta como estornado no banco.' };
    }

    if (!regData.stripeSessionId) {
      throw new Error('ID de transação Stripe ausente.');
    }

    const stripe = await getStripeInstance(db);

    // 1. Executar reembolso no Stripe
    const session = await stripe.checkout.sessions.retrieve(regData.stripeSessionId);
    const paymentIntentId = session.payment_intent as string;

    if (!paymentIntentId) throw new Error('Payment Intent não localizado.');

    const shouldReverseTransfer = role === 'admin' ? (refundType === 'shared') : true;
    
    let refundId = "SYNC_ONLY";
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        reverse_transfer: shouldReverseTransfer,
        refund_application_fee: true,
      });
      refundId = refund.id;
    } catch (stripeError: any) {
      // Caso o Stripe já tenha estornado (duplo clique ou erro de rede anterior)
      if (stripeError.code === 'charge_already_refunded' || stripeError.message?.includes('already been refunded')) {
        console.warn(`[Refund Sync] Charge already refunded in Stripe. Proceeding to sync Firestore.`);
      } else {
        throw stripeError;
      }
    }

    // 2. Preparar atualizações atômicas no Firestore via BATCH
    const batch = writeBatch(db);

    // Devolver vaga no evento pai
    const eventRef = doc(db, "events", regData.eventId);
    batch.update(eventRef, { 
      ingressosVendidos: increment(-1),
      updatedAt: serverTimestamp()
    });

    // Devolver vaga na ocorrência se existir
    if (regData.occurrenceId) {
      const occRef = doc(db, "recurring_occurrences", regData.occurrenceId);
      batch.update(occRef, {
        ingressosVendidos: increment(-1),
        updatedAt: serverTimestamp()
      });
    }

    // Atualizar o ingresso para status terminal
    batch.update(regRef, {
      status: 'refunded',
      paymentStatus: 'Estornado',
      refundId: refundId,
      refundType: refundType,
      refundedBy: role,
      refundedAt: serverTimestamp(),
      refundExecutorId: executorUid,
      updatedAt: serverTimestamp()
    });

    // Registrar Log Financeiro (Essencial para auditoria ERP)
    const logRef = doc(collection(db, 'financial_logs'));
    batch.set(logRef, {
      action: 'ticket_refund',
      category: 'payout',
      userId: executorUid,
      targetId: registrationId,
      description: `Estorno ${refundType === 'shared' ? 'Compartilhado' : 'Absorvido'} processado.`,
      metadata: {
        registrationId,
        refundId: refundId,
        amount: regData.price,
        isSync: refundId === "SYNC_ONLY"
      },
      timestamp: serverTimestamp()
    });

    // 3. Comprometer todas as alterações (Se falhar aqui, nada muda)
    await batch.commit();

    await recordAuditLog({
      userId: executorUid,
      ticketId: registrationId,
      eventId: regData.eventId,
      organizationId: regData.organizationId,
      action: 'ticket_cancel',
      category: 'ticket',
      success: true,
      metadata: { refundId, refundType, role }
    });

    return { success: true, refundId };
  } catch (error: any) {
    console.error("[Stripe Refund Action Error]", error);
    await logSystemError({
      error: { message: error.message, stack: error.stack },
      type: 'stripe_refund_failure',
      severity: 'error',
      metadata: { registrationId, role }
    });
    
    await recordAuditLog({
      userId: executorUid,
      ticketId: registrationId,
      action: 'ticket_cancel',
      category: 'ticket',
      success: false,
      errorMessage: error.message
    });

    return { success: false, error: error.message };
  }
}
