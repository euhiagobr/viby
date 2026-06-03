'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { calculateRefundAmount, calculateRetainedGatewayFee } from '@/lib/financial-utils';
import { recordAuditLog } from './audit';

export async function processTicketRefund(registrationId: string, executorUid: string, reason: string) {
  try {
    const db = getAdminDb();
    
    const result = await db.runTransaction(async (transaction) => {
      const regRef = db.collection("registrations").doc(registrationId);
      const regSnap = await transaction.get(regRef);

      if (!regSnap.exists) throw new Error("Registro não encontrado.");
      const regData = regSnap.data()!;

      const userSnap = await transaction.get(db.collection("users").doc(executorUid));
      const isAdmin = userSnap.exists && userSnap.data()?.role === 'admin';
      
      const memberSnap = await transaction.get(
        db.collection("organizations").doc(regData.organizationId).collection("members").doc(executorUid)
      );
      const isOrgManager = memberSnap.exists && ['owner', 'admin', 'editor'].includes(memberSnap.data()?.role);

      if (!isAdmin && !isOrgManager) throw new Error("Acesso negado.");
      if (regData.status === 'cancelled') throw new Error("Já estornado.");
      if (regData.checkedIn) throw new Error("Ingresso já utilizado.");

      const userId = regData.userId;
      const totalPaid = regData.price || 0;
      const eventId = regData.eventId;
      const occurrenceId = regData.occurrenceId;

      if (occurrenceId) {
        const occRef = db.collection("recurring_occurrences").doc(occurrenceId);
        const occSnap = await transaction.get(occRef);
        if (occSnap.exists && (occSnap.data()?.ingressosVendidos || 0) > 0) {
          transaction.update(occRef, { 
            ingressosVendidos: admin.firestore.FieldValue.increment(-1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp() 
          });
        }
      }
      
      const eventRef = db.collection("events").doc(eventId);
      const eventSnap = await transaction.get(eventRef);
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

      const userRef = db.collection("users").doc(userId);
      transaction.update(userRef, {
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