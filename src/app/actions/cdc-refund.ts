'use server';

import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { recordAuditLog } from './audit';
import { logSystemError } from '@/lib/error-manager';
import { createRefundRequest, getRefundRequestStateForRegistration } from '@/services/refunds/refund-request-service';

async function getStripeInstance(db: admin.firestore.Firestore) {
  const snap = await db.collection('settings').doc('stripe').get();
  const data = snap.data();
  if (!data?.secretKey) throw new Error('Secret Key do Stripe ausente.');
  return new Stripe(data.secretKey, { apiVersion: '2024-12-18.acacia' as any });
}

/**
 * Processa reembolso automático CDC (Direito de Arrependimento - Lei)
 * 
 * Validações:
 * - Compra realizada há no máximo 7 dias corridos
 * - Evento/Experiência inicia em pelo menos 48 horas
 * - Ingresso não foi utilizado (sem check-in)
 * 
 * Caso ambas validações sejam verdadeiras:
 * - Refund 100% ao comprador (Viby absorve taxa Stripe)
 * - Libera vaga (decrementa sold/ingressosVendidos)
 * - Registra auditoria com motivo CDC
 * 
 * Caso contrário:
 * - Retorna requiresApproval=true para encaminhar aprovação manual
 */
export async function requestBuyerRefundRequest(
  registrationId: string,
  userId: string,
  reason?: string
): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  return createRefundRequest({ registrationId, userId, reason });
}

export async function getBuyerRefundRequestState(registrationId: string, userId?: string) {
  return getRefundRequestStateForRegistration({ registrationId, userId });
}

export async function requestCDCRefund(
  registrationId: string,
  userId: string,
  userEmail?: string
): Promise<{
  success: boolean;
  requiresApproval?: boolean;
  message: string;
  refundId?: string;
  error?: string;
}> {
  const db = getAdminDb();

  try {
    // 1. BUSCAR REGISTRATION
    const regRef = db.collection('registrations').doc(registrationId);
    const regSnap = await regRef.get();

    if (!regSnap.exists) {
      throw new Error('Ingresso não localizado.');
    }

    const regData = regSnap.data()!;

    // 2. VALIDAÇÃO: Ingresso já utilizado
    if (regData.checkedIn === true) {
      return {
        success: false,
        message: 'Não é possível cancelar ingresso já utilizado.',
        error: 'already_checked_in'
      };
    }

    // 3. VALIDAÇÃO: Ingresso já cancelado/reembolsado
    if (regData.status === 'cancelled' || regData.status === 'refunded' ||
        regData.paymentStatus === 'Estornado' || regData.paymentStatus === 'Cancelado') {
      return {
        success: false,
        message: 'Este ingresso já foi cancelado ou reembolsado.',
        error: 'already_refunded'
      };
    }

    // 4. VALIDAÇÃO: Ingresso gratuito
    const totalPaid = regData.price || 0;
    if (totalPaid <= 0) {
      return {
        success: false,
        message: 'Reembolso CDC aplica apenas a ingressos pagos.',
        error: 'free_ticket'
      };
    }

    // 5. VALIDAÇÃO: Sem sessão Stripe
    if (!regData.stripeSessionId) {
      return {
        success: false,
        message: 'Transação Stripe não encontrada.',
        error: 'no_stripe_session'
      };
    }

    // 6. VALIDAÇÃO: 7 dias desde compra
    const createdDate = regData.createdAt?.toDate?.() || new Date(regData.createdAt);
    const now = new Date();
    const daysSinceCreation = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceCreation > 7) {
      return {
        success: false,
        requiresApproval: true,
        message: `Prazo de 7 dias para reembolso CDC expirado (${Math.floor(daysSinceCreation)} dias).`,
        error: 'exceeded_7_days'
      };
    }

    // 7. VALIDAÇÃO: 48 horas antes do evento
    const eventDate = regData.eventDate?.toDate?.() || new Date(regData.eventDate);
    const hoursUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilEvent < 48) {
      return {
        success: false,
        requiresApproval: true,
        message: `Evento inicia em ${Math.floor(hoursUntilEvent)} horas (mínimo 48h necessário).`,
        error: 'less_48_hours'
      };
    }

    // 8. VALIDAÇÕES PASSOU: Proceder com Refund Stripe
    const stripe = await getStripeInstance(db);
    const session = await stripe.checkout.sessions.retrieve(regData.stripeSessionId);
    const paymentIntentId = session.payment_intent as string;

    if (!paymentIntentId) {
      throw new Error('Payment Intent ID não encontrado na sessão Stripe.');
    }

    // 9. CRIAR REFUND NO STRIPE
    // reverse_transfer: true → desfaz transfer para organizador
    // refund_application_fee: true → Viby também devolve sua fee (CDC é sem custo para Viby)
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reverse_transfer: true,
      refund_application_fee: true
    });

    if (refund.status !== 'succeeded') {
      throw new Error(`Refund no Stripe retornou status: ${refund.status}`);
    }

    // 10. ATUALIZAR FIRESTORE EM TRANSAÇÃO (atomicidade)
    await db.runTransaction(async (transaction) => {
      // 10a. Atualizar registration
      transaction.update(regRef, {
        status: 'refunded',
        paymentStatus: 'Estornado',
        refundType: 'cdc',
        refundedAt: admin.firestore.FieldValue.serverTimestamp(),
        refundStripeId: refund.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 10b. Liberar vaga (decrementar sold)
      const occurrenceId = regData.occurrenceId;
      const productType = regData.productType || 'event';
      const isExp = productType === 'experience';

      if (occurrenceId) {
        const occRef = isExp
          ? db.collection('experiences').doc(regData.eventId).collection('slots').doc(occurrenceId)
          : db.collection('recurring_occurrences').doc(occurrenceId);

        transaction.update(occRef, {
          sold: admin.firestore.FieldValue.increment(-1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // 10c. Decrementar ingressos vendidos no event/experience
      const sourceColl = isExp ? 'experiences' : 'events';
      const eventRef = db.collection(sourceColl).doc(regData.eventId);

      if (isExp) {
        transaction.update(eventRef, {
          sold: admin.firestore.FieldValue.increment(-1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        transaction.update(eventRef, {
          ingressosVendidos: admin.firestore.FieldValue.increment(-1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });

    // 11. REGISTRAR AUDITORIA
    await recordAuditLog({
      userId,
      userEmail: userEmail || 'unknown',
      organizationId: regData.organizationId,
      eventId: regData.eventId,
      ticketId: registrationId,
      action: 'cdc_refund_auto',
      category: 'ticket',
      success: true,
      metadata: {
        daysSinceCreation: Math.floor(daysSinceCreation),
        hoursUntilEvent: Math.floor(hoursUntilEvent),
        refundAmount: totalPaid,
        stripeRefundId: refund.id,
        refundStatus: refund.status
      }
    });

    return {
      success: true,
      message: `Reembolso de R$ ${(totalPaid / 100).toFixed(2)} processado com sucesso (CDC).`,
      refundId: refund.id
    };

  } catch (error: any) {
    console.error('[CDC Refund] Error:', error);
    await logSystemError({
      context: 'requestCDCRefund',
      error: error.message,
      registrationId,
      userId
    });

    return {
      success: false,
      message: 'Erro ao processar reembolso CDC.',
      error: error.message
    };
  }
}
