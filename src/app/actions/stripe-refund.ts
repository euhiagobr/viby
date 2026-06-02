
'use server';

import Stripe from 'stripe';
import { doc, getDoc, getFirestore, updateDoc, serverTimestamp, collection, addDoc, increment } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { logSystemError } from '@/lib/error-manager';

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
 * Processa o estorno de um ingresso via Stripe Connect Destination Charges
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

    if (regData.status === 'refunded' || regData.paymentStatus === 'Estornado') {
      throw new Error('Este ingresso já foi estornado.');
    }

    if (!regData.stripeSessionId) {
      throw new Error('Este ingresso não possui um ID de transação Stripe válido.');
    }

    const stripe = await getStripeInstance(db);

    // 1. Recuperar a sessão para obter o PaymentIntent
    const session = await stripe.checkout.sessions.retrieve(regData.stripeSessionId);
    const paymentIntentId = session.payment_intent as string;

    if (!paymentIntentId) throw new Error('Payment Intent não localizado para esta sessão.');

    // 2. Definir parâmetros do reembolso baseado nas regras de negócio
    // Organizador: Sempre compartilhado (reverse_transfer=true)
    // Admin: Pode escolher
    const shouldReverseTransfer = role === 'admin' ? (refundType === 'shared') : true;
    
    // Na Viby, em estornos autorizados, a plataforma sempre devolve sua taxa (refund_application_fee)
    // para que o cliente receba 100% do valor pago.
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
      reverse_transfer: shouldReverseTransfer,
      refund_application_fee: true,
    };

    // 3. Executar reembolso no Stripe
    const refund = await stripe.refunds.create(refundParams);

    // 4. Atualizar Inventário (Devolver vaga)
    const eventRef = doc(db, "events", regData.eventId);
    await updateDoc(eventRef, { 
      ingressosVendidos: increment(-1),
      updatedAt: serverTimestamp()
    });

    if (regData.occurrenceId) {
      const occRef = doc(db, "recurring_occurrences", regData.occurrenceId);
      await updateDoc(occRef, {
        ingressosVendidos: increment(-1),
        updatedAt: serverTimestamp()
      });
    }

    // 5. Atualizar Firestore
    await updateDoc(regRef, {
      status: 'refunded',
      paymentStatus: 'Estornado',
      refundId: refund.id,
      refundType: refundType,
      refundedBy: role,
      refundedAt: serverTimestamp(),
      refundExecutorId: executorUid,
      updatedAt: serverTimestamp()
    });

    // 6. Log de Auditoria
    await addDoc(collection(db, 'financial_logs'), {
      action: 'ticket_refund',
      category: 'payout',
      userId: executorUid,
      targetId: registrationId,
      description: `Estorno ${refundType === 'shared' ? 'Compartilhado' : 'Absorvido pela Viby'} processado via Stripe.`,
      metadata: {
        registrationId,
        refundId: refund.id,
        amount: regData.price,
        type: refundType
      },
      timestamp: serverTimestamp()
    });

    return { success: true, refundId: refund.id };
  } catch (error: any) {
    await logSystemError({
      error: { message: error.message, stack: error.stack },
      type: 'stripe_refund_failure',
      severity: 'error',
      metadata: { registrationId, role }
    });
    return { success: false, error: error.message };
  }
}
