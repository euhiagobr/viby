'use server';

import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { recordAuditLog } from './audit';
import { logSystemError } from '@/lib/error-manager';

async function getStripeInstance(db: admin.firestore.Firestore) {
  const snap = await db.collection('settings').doc('stripe').get();
  const data = snap.data();
  if (!data?.secretKey) throw new Error('Secret Key do Stripe ausente.');
  return new Stripe(data.secretKey, { apiVersion: '2024-12-18.acacia' as any });
}

/**
 * Processa reembolso manual aprovado pelo organizador
 * 
 * Características:
 * - Sem validações de prazo (organizador tem liberdade total)
 * - Aplicável a ingressos pagos OU gratuitos
 * - Para ingressos pagos: Stripe refund com refund_application_fee=false (Viby retém fee)
 * - Para ingressos gratuitos: Devolução de saldo de carteira
 * - Registra motivo da aprovação
 * - Auditado como ação administrativa/cortesia
 * 
 * Diferenças:
 * - CDC: automático, validações estritas (7d + 48h), refund_application_fee=true
 * - Org Cancellation: lote automático por evento, refund_application_fee=false
 * - Manual Refund: individual, decisão org, refund_application_fee=false
 */
export async function requestManualRefund(params: {
  registrationId: string;
  organizationId: string;
  userId: string;
  userEmail?: string;
  approvalReason: string;
  approvalNotes?: string;
}): Promise<{
  success: boolean;
  message: string;
  refundId?: string;
  error?: string;
}> {
  const db = getAdminDb();
  const { registrationId, organizationId, userId, userEmail, approvalReason, approvalNotes } = params;

  try {
    // 1. VALIDAR PERMISSÃO DO USUÁRIO (owner/admin da org)
    const orgRef = db.collection('organizations').doc(organizationId);
    const memberRef = orgRef.collection('members').doc(userId);
    const memberSnap = await memberRef.get();

    if (!memberSnap.exists || !['owner', 'admin'].includes(memberSnap.data()?.role)) {
      throw new Error('Acesso negado. Apenas proprietários e administradores podem aprovar reembolsos.');
    }

    // 2. BUSCAR E VALIDAR REGISTRATION
    const regRef = db.collection('registrations').doc(registrationId);
    const regSnap = await regRef.get();

    if (!regSnap.exists) {
      throw new Error('Ingresso não encontrado.');
    }

    const regData = regSnap.data()!;

    // 3. VALIDAR ORGANIZAÇÃO
    if (regData.organizationId !== organizationId) {
      throw new Error('Este ingresso não pertence à sua organização.');
    }

    // 4. VALIDAR STATUS
    if (regData.status === 'cancelled' || regData.status === 'refunded' ||
        regData.paymentStatus === 'Estornado' || regData.paymentStatus === 'Cancelado') {
      return {
        success: false,
        message: 'Este ingresso já foi cancelado ou reembolsado.',
        error: 'already_refunded'
      };
    }

    // 5. DIFERENCIAÇÃO: Ingresso pago vs gratuito
    const totalPaid = regData.price || 0;

    if (totalPaid > 0) {
      // ===== INGRESSO PAGO: Usar Stripe =====

      if (!regData.stripeSessionId) {
        return {
          success: false,
          message: 'Transação Stripe não encontrada.',
          error: 'no_stripe_session'
        };
      }

      const stripe = await getStripeInstance(db);
      const session = await stripe.checkout.sessions.retrieve(regData.stripeSessionId);
      const paymentIntentId = session.payment_intent as string;

      if (!paymentIntentId) {
        throw new Error('Payment Intent ID não encontrado.');
      }

      // CRIAR REFUND COM VIBY RETENDO FEE
      // reverse_transfer: true → impacto saldo organizador (como org cancellation)
      // refund_application_fee: false → Viby MANTÉM sua fee (cortesia)
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        reverse_transfer: true,
        refund_application_fee: false
      });

      if (refund.status !== 'succeeded') {
        throw new Error(`Refund retornou status: ${refund.status}`);
      }

      // 6a. ATUALIZAR FIRESTORE (ingresso pago)
      await db.runTransaction(async (transaction) => {
        // Atualizar registration
        transaction.update(regRef, {
          status: 'refunded',
          paymentStatus: 'Estornado',
          refundType: 'manual_approval',
          refundedAt: admin.firestore.FieldValue.serverTimestamp(),
          refundStripeId: refund.id,
          refundApprovedBy: userId,
          refundApprovalReason: approvalReason,
          refundApprovalNotes: approvalNotes || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Liberar vaga (decrementar sold)
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

        // Decrementar ingressos vendidos
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

      // 7a. AUDITORIA (ingresso pago)
      await recordAuditLog({
        userId,
        userEmail: userEmail || 'unknown',
        organizationId,
        eventId: regData.eventId,
        ticketId: registrationId,
        action: 'manual_refund_approval',
        category: 'finance',
        success: true,
        metadata: {
          refundAmount: totalPaid,
          refundType: 'paid_ticket',
          approvalReason,
          approvalNotes,
          stripeRefundId: refund.id,
          refundStatus: refund.status
        }
      });

      return {
        success: true,
        message: `Reembolso de R$ ${(totalPaid / 100).toFixed(2)} aprovado (Manual - Ingresso Pago).`,
        refundId: refund.id
      };

    } else {
      // ===== INGRESSO GRATUITO: Apenas marcar como cancelado =====

      await db.runTransaction(async (transaction) => {
        // Atualizar registration
        transaction.update(regRef, {
          status: 'cancelled',
          paymentStatus: 'Cancelado',
          refundType: 'manual_approval',
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
          cancelledBy: userId,
          cancelledByRole: 'organizer',
          cancelReason: approvalReason,
          refundApprovalNotes: approvalNotes || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Liberar vaga (decrementar sold)
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

        // Decrementar ingressos vendidos
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

      // 7b. AUDITORIA (ingresso gratuito)
      await recordAuditLog({
        userId,
        userEmail: userEmail || 'unknown',
        organizationId,
        eventId: regData.eventId,
        ticketId: registrationId,
        action: 'manual_refund_approval',
        category: 'finance',
        success: true,
        metadata: {
          refundType: 'free_ticket',
          approvalReason,
          approvalNotes,
          message: 'Ingresso gratuito cancelado por aprovação manual'
        }
      });

      return {
        success: true,
        message: `Cancelamento aprovado (Manual - Ingresso Gratuito).`
      };
    }

  } catch (error: any) {
    console.error('[Manual Refund] Error:', error);
    await logSystemError({
      context: 'requestManualRefund',
      error: error.message,
      registrationId,
      organizationId,
      userId
    });

    return {
      success: false,
      message: 'Erro ao processar reembolso manual.',
      error: error.message
    };
  }
}

/**
 * Rejeita uma solicitação de reembolso manual
 * (Útil se implementarmos workflow de aprovação/rejeição)
 */
export async function rejectManualRefund(params: {
  registrationId: string;
  organizationId: string;
  userId: string;
  rejectionReason: string;
}): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  const db = getAdminDb();
  const { registrationId, organizationId, userId, rejectionReason } = params;

  try {
    const regRef = db.collection('registrations').doc(registrationId);
    
    // Atualizar com flag de rejeição (optional, para audit trail)
    await regRef.update({
      refundRejectedAt: admin.firestore.FieldValue.serverTimestamp(),
      refundRejectedBy: userId,
      refundRejectionReason: rejectionReason,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await recordAuditLog({
      userId,
      organizationId,
      eventId: (await regRef.get()).data()?.eventId,
      ticketId: registrationId,
      action: 'manual_refund_approval',
      category: 'finance',
      success: false,
      errorMessage: `Reembolso rejeitado: ${rejectionReason}`,
      metadata: {
        action: 'rejected',
        rejectionReason
      }
    });

    return {
      success: true,
      message: 'Reembolso rejeitado e registrado na auditoria.'
    };
  } catch (error: any) {
    console.error('[Manual Refund Reject] Error:', error);
    return {
      success: false,
      message: 'Erro ao rejeitar reembolso.',
      error: error.message
    };
  }
}
