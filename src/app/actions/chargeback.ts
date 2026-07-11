'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { recordAuditLog } from './audit';
import { logSystemError } from '@/lib/error-manager';

/**
 * Processa chargeback/disputa do Stripe
 * Chamado automaticamente pelos webhooks
 */

export interface ChargebackData {
  stripeDisputeId: string;
  chargeId: string;
  organizationId: string;
  registrationId?: string;
  eventId?: string;
  amount: number;
  currency: string;
  reason: string;
  reasonCode: string;
  status: 'warning_needs_response' | 'under_review' | 'won' | 'lost';
  evidenceDueBy?: Date;
  balanceTransaction?: string;
}

/**
 * Registra novo chargeback no Firestore
 */
export async function recordChargeback(data: ChargebackData): Promise<string> {
  const db = getAdminDb();
  
  try {
    const chargebackRef = db.collection('chargebacks').doc(data.stripeDisputeId);
    
    await chargebackRef.set({
      organizationId: data.organizationId,
      registrationId: data.registrationId || null,
      eventId: data.eventId || null,
      chargeId: data.chargeId,
      amount: data.amount,
      currency: data.currency,
      reason: data.reason,
      reasonCode: data.reasonCode,
      status: data.status,
      evidenceDueBy: data.evidenceDueBy ? admin.firestore.Timestamp.fromDate(data.evidenceDueBy) : null,
      balanceTransaction: data.balanceTransaction || null,
      evidence: [],
      notificationSent: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[Chargeback] Registered dispute ${data.stripeDisputeId}`);
    return data.stripeDisputeId;
  } catch (error: any) {
    console.error('[Chargeback] Error registering:', error);
    throw error;
  }
}

/**
 * Atualiza status de chargeback existente
 */
export async function updateChargebackStatus(
  stripeDisputeId: string,
  status: 'warning_needs_response' | 'under_review' | 'won' | 'lost',
  updates?: {
    reason?: string;
    reasonCode?: string;
    evidenceDueBy?: Date;
    balanceTransaction?: string;
  }
): Promise<void> {
  const db = getAdminDb();

  try {
    const chargebackRef = db.collection('chargebacks').doc(stripeDisputeId);
    const chargebackSnap = await chargebackRef.get();

    if (!chargebackSnap.exists) {
      throw new Error('Chargeback não encontrado');
    }

    const updateData: any = {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (updates?.reason) updateData.reason = updates.reason;
    if (updates?.reasonCode) updateData.reasonCode = updates.reasonCode;
    if (updates?.evidenceDueBy) {
      updateData.evidenceDueBy = admin.firestore.Timestamp.fromDate(updates.evidenceDueBy);
    }
    if (updates?.balanceTransaction) {
      updateData.balanceTransaction = updates.balanceTransaction;
    }

    // Se disputa foi perdida, marca como fechada
    if (status === 'lost') {
      updateData.closedAt = admin.firestore.FieldValue.serverTimestamp();
      updateData.closedReason = 'lost';
    }

    // Se disputa foi ganha, marca como fechada
    if (status === 'won') {
      updateData.closedAt = admin.firestore.FieldValue.serverTimestamp();
      updateData.closedReason = 'won';
    }

    await chargebackRef.update(updateData);
    console.log(`[Chargeback] Updated dispute ${stripeDisputeId} to status: ${status}`);
  } catch (error: any) {
    console.error('[Chargeback] Error updating:', error);
    throw error;
  }
}

/**
 * Marca registration como em disputa
 */
export async function markRegistrationAsDisputed(
  registrationId: string,
  stripeDisputeId: string
): Promise<void> {
  const db = getAdminDb();

  try {
    const regRef = db.collection('registrations').doc(registrationId);
    
    await regRef.update({
      status: 'disputed',
      stripeDisputeId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[Chargeback] Marked registration ${registrationId} as disputed`);
  } catch (error: any) {
    console.error('[Chargeback] Error marking registration:', error);
    // Não lança erro se registration não existir (pode ser ordem antiga)
  }
}

/**
 * Resolve disputa como fechada
 */
export async function closeChargebackDispute(
  registrationId: string,
  stripeDisputeId: string,
  outcome: 'won' | 'lost'
): Promise<void> {
  const db = getAdminDb();

  try {
    const regRef = db.collection('registrations').doc(registrationId);
    
    // Se disputa foi ganha, restaura ingresso para status ativo
    if (outcome === 'won') {
      await regRef.update({
        status: 'active', // Volta para ativo
        stripeDisputeResolved: true,
        stripeDisputeOutcome: 'won',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // Se perdida, mantém como disputed mas marca como resolvida
      await regRef.update({
        status: 'disputed_lost',
        stripeDisputeResolved: true,
        stripeDisputeOutcome: 'lost',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    console.log(`[Chargeback] Resolved registration ${registrationId} with outcome: ${outcome}`);
  } catch (error: any) {
    console.error('[Chargeback] Error closing dispute:', error);
  }
}

/**
 * Busca registration a partir de charge ID do Stripe
 * (útil para vincular disputa ao ingresso)
 */
export async function findRegistrationByChargeId(chargeId: string): Promise<any | null> {
  const db = getAdminDb();

  try {
    const regsSnap = await db.collection('registrations')
      .where('stripeChargeId', '==', chargeId)
      .limit(1)
      .get();

    if (regsSnap.empty) return null;
    
    return {
      id: regsSnap.docs[0].id,
      ...regsSnap.docs[0].data()
    };
  } catch (error: any) {
    console.error('[Chargeback] Error finding registration:', error);
    return null;
  }
}

/**
 * Registra evento de chargeback na auditoria
 */
export async function auditChargebackEvent(params: {
  stripeDisputeId: string;
  organizationId: string;
  registrationId?: string;
  eventId?: string;
  amount: number;
  action: 'chargeback_created' | 'chargeback_updated' | 'chargeback_closed';
  reason: string;
  reasonCode: string;
  status: string;
  outcome?: 'won' | 'lost';
}): Promise<void> {
  try {
    await recordAuditLog({
      organizationId: params.organizationId,
      eventId: params.eventId,
      ticketId: params.registrationId,
      action: params.action,
      category: 'finance',
      success: true,
      metadata: {
        stripeDisputeId: params.stripeDisputeId,
        amount: params.amount,
        reason: params.reason,
        reasonCode: params.reasonCode,
        status: params.status,
        outcome: params.outcome
      }
    });
  } catch (error: any) {
    console.warn('[Chargeback Audit] Error recording:', error);
    // Não bloqueamos se falhar auditoria
  }
}
