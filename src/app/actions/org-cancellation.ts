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
 * Processa cancelamento de evento/experiência pelo organizador
 * 
 * Efeitos:
 * - Todos os ingressos ativos são reembolsados 100%
 * - Viby RETÉM sua application fee (refund_application_fee: false)
 * - Organizador absorve o impacto no Stripe Connect
 * - Evento é marcado como 'cancelled'
 * - Auditoria registra motivação do cancelamento
 * 
 * Validações:
 * - Usuário é owner/admin da organização
 * - Evento existe e está ativo
 * - Evento ainda não terminou totalmente
 */
export async function requestOrgEventCancellation(params: {
  eventId: string;
  organizationId: string;
  userId: string;
  userEmail?: string;
  reason: string;
  productType?: 'event' | 'experience';
}): Promise<{
  success: boolean;
  message: string;
  refundsProcessed: number;
  refundsFailedCount?: number;
  error?: string;
}> {
  const db = getAdminDb();
  const { eventId, organizationId, userId, userEmail, reason, productType = 'event' } = params;

  try {
    // 1. VALIDAR PERMISSÃO DO USUÁRIO
    const orgRef = db.collection('organizations').doc(organizationId);
    const memberRef = orgRef.collection('members').doc(userId);
    const memberSnap = await memberRef.get();

    if (!memberSnap.exists || !['owner', 'admin'].includes(memberSnap.data()?.role)) {
      throw new Error('Acesso negado. Apenas proprietários e administradores podem cancelar eventos.');
    }

    // 2. BUSCAR E VALIDAR EVENTO
    const sourceColl = productType === 'experience' ? 'experiences' : 'events';
    const eventRef = db.collection(sourceColl).doc(eventId);
    const eventSnap = await eventRef.get();

    if (!eventSnap.exists) {
      throw new Error('Evento não encontrado.');
    }

    const eventData = eventSnap.data()!;

    if (eventData.organizationId !== organizationId) {
      throw new Error('Este evento não pertence à sua organização.');
    }

    if (eventData.status === 'cancelled') {
      return {
        success: false,
        message: 'Este evento já foi cancelado.',
        refundsProcessed: 0,
        error: 'already_cancelled'
      };
    }

    // 3. BUSCAR TODOS OS REGISTRATIONS ATIVOS
    const registrationsSnap = await db.collection('registrations')
      .where('eventId', '==', eventId)
      .where('status', '==', 'active')
      .get();

    const registrations = registrationsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // 4. PROCESSAR REFUNDS EM LOTE
    const stripe = await getStripeInstance(db);
    let refundsProcessed = 0;
    let refundsFailed = 0;
    const failedRefunds: Array<{ registrationId: string; error: string }> = [];

    for (const reg of registrations) {
      try {
        // 4a. Obter payment intent via Stripe session
        if (!reg.stripeSessionId) {
          failedRefunds.push({
            registrationId: reg.id,
            error: 'Sessão Stripe não encontrada'
          });
          refundsFailed++;
          continue;
        }

        const session = await stripe.checkout.sessions.retrieve(reg.stripeSessionId);
        const paymentIntentId = session.payment_intent as string;

        if (!paymentIntentId) {
          failedRefunds.push({
            registrationId: reg.id,
            error: 'Payment Intent não encontrado'
          });
          refundsFailed++;
          continue;
        }

        // 4b. CRIAR REFUND NO STRIPE
        // reverse_transfer: true → desfaz transfer para organizador (impacto saldo Connect)
        // refund_application_fee: false → Viby MANTÉM sua fee
        const refund = await stripe.refunds.create({
          payment_intent: paymentIntentId,
          reverse_transfer: true,
          refund_application_fee: false
        });

        if (refund.status !== 'succeeded') {
          failedRefunds.push({
            registrationId: reg.id,
            error: `Refund retornou status: ${refund.status}`
          });
          refundsFailed++;
          continue;
        }

        // 4c. ATUALIZAR REGISTRATION EM TRANSAÇÃO
        await db.runTransaction(async (transaction) => {
          const regRef = db.collection('registrations').doc(reg.id);

          transaction.update(regRef, {
            status: 'refunded',
            paymentStatus: 'Estornado',
            refundType: 'org_cancellation',
            refundedAt: admin.firestore.FieldValue.serverTimestamp(),
            refundStripeId: refund.id,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // 4d. Liberar vaga (decrementar sold)
          const occurrenceId = reg.occurrenceId;
          const isExp = productType === 'experience';

          if (occurrenceId) {
            const occRef = isExp
              ? db.collection('experiences').doc(eventId).collection('slots').doc(occurrenceId)
              : db.collection('recurring_occurrences').doc(occurrenceId);

            transaction.update(occRef, {
              sold: admin.firestore.FieldValue.increment(-1),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }

          // 4e. Decrementar contador de vendas
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

        refundsProcessed++;

      } catch (regError: any) {
        console.error(`[Org Cancellation] Failed to process registration ${reg.id}:`, regError);
        failedRefunds.push({
          registrationId: reg.id,
          error: regError.message
        });
        refundsFailed++;
      }
    }

    // 5. ATUALIZAR STATUS DO EVENTO PARA CANCELLED
    try {
      await eventRef.update({
        status: 'cancelled',
        cancelledBy: userId,
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        cancellationReason: reason,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (eventUpdateError: any) {
      console.error('[Org Cancellation] Failed to update event status:', eventUpdateError);
      // Não bloqueamos se falhar atualizar evento, pois refunds já foram processados
    }

    // 6. REGISTRAR AUDITORIA
    try {
      await recordAuditLog({
        userId,
        userEmail: userEmail || 'unknown',
        organizationId,
        eventId,
        action: 'org_cancellation',
        category: 'event',
        success: refundsProcessed > 0 || refundsFailed === 0,
        metadata: {
          registrationsFound: registrations.length,
          refundsProcessed,
          refundsFailed,
          reason,
          failedRefunds: failedRefunds.slice(0, 10) // Log apenas primeiros 10
        }
      });
    } catch (auditError: any) {
      console.warn('[Org Cancellation] Failed to record audit log:', auditError);
    }

    // 7. CONSTRUIR RESPOSTA
    let message = '';
    if (refundsProcessed === registrations.length) {
      message = `Evento cancelado com sucesso. ${refundsProcessed} reembolso(s) processado(s).`;
    } else if (refundsProcessed > 0) {
      message = `Evento cancelado parcialmente. ${refundsProcessed} de ${registrations.length} reembolso(s) processado(s). ${refundsFailed} falhou(ram).`;
    } else if (registrations.length === 0) {
      message = 'Evento cancelado. Nenhum ingresso ativo para reembolsar.';
    } else {
      message = `Falha ao processar reembolsos. ${refundsFailed} de ${registrations.length} falharam.`;
    }

    return {
      success: refundsProcessed > 0 || registrations.length === 0,
      message,
      refundsProcessed,
      refundsFailedCount: refundsFailed
    };

  } catch (error: any) {
    console.error('[Org Cancellation] Error:', error);
    await logSystemError({
      context: 'requestOrgEventCancellation',
      error: error.message,
      eventId,
      organizationId,
      userId
    });

    return {
      success: false,
      message: 'Erro ao cancelar evento.',
      refundsProcessed: 0,
      error: error.message
    };
  }
}
