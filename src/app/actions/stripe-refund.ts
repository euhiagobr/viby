'use server';

import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { logSystemError } from '@/lib/error-manager';
import { recordAuditLog } from './audit';

async function getStripeInstance(db: admin.firestore.Firestore) {
  const snap = await db.collection('settings').doc('stripe').get();
  if (!snap.exists) throw new Error('Configurações do Stripe não localizadas.');
  const data = snap.data();
  const secretKey = data?.secretKey?.trim();
  if (!secretKey) throw new Error('Secret Key do Stripe ausente.');
  return new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' as any });
}

export type RefundType = 'shared' | 'platform_absorbed';

export async function processStripeRefund(params: {
  registrationId: string;
  executorUid: string;
  role: 'admin' | 'organizer';
  refundType: RefundType;
}) {
  const { registrationId, executorUid, role, refundType } = params;
  const db = getAdminDb();

  try {
    const regRef = db.collection('registrations').doc(registrationId);
    const regSnap = await regRef.get();

    if (!regSnap.exists) throw new Error('Ingresso não localizado.');
    const regData = regSnap.data()!;

    if (regData.status === 'refunded' || regData.paymentStatus === 'Estornado') {
      return { success: true, message: 'Este ingresso já consta como estornado no banco.' };
    }

    if (!regData.stripeSessionId) {
      throw new Error('ID de transação Stripe ausente.');
    }

    const stripe = await getStripeInstance(db);
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
      if (stripeError.code === 'charge_already_refunded' || stripeError.message?.includes('already been refunded')) {
        console.warn(`[Refund Sync] Charge already refunded in Stripe. Proceeding to sync Firestore.`);
      } else {
        throw stripeError;
      }
    }

    const batch = db.batch();
    const eventRef = db.collection("events").doc(regData.eventId);
    batch.update(eventRef, { 
      ingressosVendidos: admin.firestore.FieldValue.increment(-1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    if (regData.occurrenceId) {
      const occRef = db.collection("recurring_occurrences").doc(regData.occurrenceId);
      batch.update(occRef, {
        ingressosVendidos: admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    batch.update(regRef, {
      status: 'refunded',
      paymentStatus: 'Estornado',
      refundId: refundId,
      refundType: refundType,
      refundedBy: role,
      refundedAt: admin.firestore.FieldValue.serverTimestamp(),
      refundExecutorId: executorUid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const logRef = db.collection('financial_logs').doc();
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
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

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