
'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { calculateRefundAmount, calculateRetainedGatewayFee } from '@/lib/financial-utils';
import { recordAuditLog } from './audit';

export async function processTicketRefund(registrationId: string, executorUid: string, reason: string) {
  try {
    const db = getAdminDb();
    
    const result = await db.runTransaction(async (transaction) => {
      // 1. DEFINIÇÃO DAS REFERÊNCIAS
      const regRef = db.collection("registrations").doc(registrationId);
      const userRef = db.collection("users").doc(executorUid);

      // 2. BLOCO DE LEITURA (Obrigatório antes de qualquer escrita)
      const regSnap = await transaction.get(regRef);
      if (!regSnap.exists) throw new Error("Registro não encontrado.");
      const regData = regSnap.data()!;

      const userSnap = await transaction.get(userRef);
      const isAdmin = userSnap.exists && userSnap.data()?.role === 'admin';
      
      const orgRef = db.collection("organizations").doc(regData.organizationId);
      const memberRef = orgRef.collection("members").doc(executorUid);
      const memberSnap = await transaction.get(memberRef);
      const isOrgManager = memberSnap.exists && ['owner', 'admin', 'editor'].includes(memberSnap.data()?.role);

      if (!isAdmin && !isOrgManager) throw new Error("Acesso negado.");
      if (regData.status === 'cancelled') throw new Error("Já estornado.");
      if (regData.checkedIn) throw new Error("Ingresso já utilizado.");

      const occurrenceId = regData.occurrenceId;
      let occSnap = null;
      if (occurrenceId) {
        occSnap = await transaction.get(db.collection("recurring_occurrences").doc(occurrenceId));
      }

      const eventRef = db.collection("events").doc(regData.eventId);
      const eventSnap = await transaction.get(eventRef);

      // 3. BLOCO DE ESCRITA
      const userId = regData.userId;
      const totalPaid = regData.price || 0;

      if (occurrenceId && occSnap?.exists && (occSnap.data()?.ingressosVendidos || 0) > 0) {
        transaction.update(db.collection("recurring_occurrences").doc(occurrenceId), { 
          ingressosVendidos: admin.firestore.FieldValue.increment(-1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp() 
        });
      }
      
      if (eventSnap.exists && (eventSnap.data()?.ingressosVendidos || 0) > 0) {
        transaction.update(eventRef, { 
          ingressosVendidos: admin.firestore.FieldValue.increment(-1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp() 
        });
      }

      if (totalPaid <= 0) {
        transaction.update(regRef, {
          status: 'cancelled',
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
          cancelledBy: executorUid,
          cancelReason: reason
        });
        return { success: true, isFree: true, orgId: regData.organizationId, eventId: regData.eventId };
      }

      const refundAmount = calculateRefundAmount(totalPaid);
      const retainedFee = calculateRetainedGatewayFee(totalPaid);

      transaction.update(regRef, {
        status: 'cancelled',
        paymentStatus: 'refunded_wallet',
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        cancelledBy: executorUid,
        cancelReason: reason,
        refundAmount: refundAmount,
        retainedFee: retainedFee,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const walletRef = db.collection("wallets").doc(userId);
      transaction.set(walletRef, {
        balance: admin.firestore.FieldValue.increment(refundAmount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      const targetUserRef = db.collection("users").doc(userId);
      transaction.update(targetUserRef, {
        walletBalance: admin.firestore.FieldValue.increment(refundAmount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, refundAmount, orgId: regData.organizationId, eventId: regData.eventId };
    });

    await recordAuditLog({
      userId: executorUid,
      ticketId: registrationId,
      organizationId: result.orgId,
      eventId: result.eventId,
      action: 'ticket_cancel',
      category: 'ticket',
      success: true,
      metadata: { refundAmount: result.refundAmount, reason }
    });

    return result;
  } catch (error: any) {
    console.error("Erro no estorno:", error.message);
    
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
