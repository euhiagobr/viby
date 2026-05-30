'use server';

import { getAdminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { calculateRefundAmount, calculateRetainedGatewayFee } from '@/lib/financial-utils';

/**
 * @fileOverview Server Actions para operações financeiras transacionais utilizando o Admin SDK.
 * Implementa a devolução de inventário e estorno de saldo.
 * ATUALIZADO: Proteção contra contadores negativos e sincronização pai-filho no Admin.
 */

export async function processTicketRefund(registrationId: string, executorUid: string, reason: string) {
  try {
    const db = getAdminDb();
    
    return await db.runTransaction(async (transaction) => {
      const regRef = db.collection("registrations").doc(registrationId);
      const regSnap = await transaction.get(regRef);

      if (!regSnap.exists) throw new Error("Registro não encontrado.");
      const regData = regSnap.data()!;

      // Validação de Segurança
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

      // 1. Devolução de Capacidade - PROTEÇÃO CONTRA NEGATIVOS
      if (occurrenceId) {
        const occRef = db.collection("recurring_occurrences").doc(occurrenceId);
        const occSnap = await transaction.get(occRef);
        if (occSnap.exists && (occSnap.data()?.ingressosVendidos || 0) > 0) {
          transaction.update(occRef, { ingressosVendidos: FieldValue.increment(-1) });
        }
      }
      
      const eventRef = db.collection("events").doc(eventId);
      const eventSnap = await transaction.get(eventRef);
      if (eventSnap.exists && (eventSnap.data()?.ingressosVendidos || 0) > 0) {
        transaction.update(eventRef, { ingressosVendidos: FieldValue.increment(-1) });
      }

      // Se for gratuito
      if (totalPaid <= 0) {
        transaction.update(regRef, {
          status: 'cancelled',
          cancelledAt: FieldValue.serverTimestamp(),
          cancelledBy: executorUid,
          cancelReason: reason
        });
        return { success: true, isFree: true };
      }

      const refundAmount = calculateRefundAmount(totalPaid);
      const retainedFee = calculateRetainedGatewayFee(totalPaid);

      // 2. Atualizar Registro do Ingresso
      transaction.update(regRef, {
        status: 'cancelled',
        paymentStatus: 'refunded_wallet',
        cancelledAt: FieldValue.serverTimestamp(),
        cancelledBy: executorUid,
        cancelReason: reason,
        refundAmount: refundAmount,
        retainedFee: retainedFee
      });

      // 3. Devolução para Carteira
      const walletRef = db.collection("wallets").doc(userId);
      transaction.set(walletRef, {
        balance: FieldValue.increment(refundAmount),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      const userRef = db.collection("users").doc(userId);
      transaction.update(userRef, {
        walletBalance: FieldValue.increment(refundAmount),
        updatedAt: FieldValue.serverTimestamp()
      });

      // 4. Registro Fiscal
      const taxQ = await db.collection("tax_tickets").where("registrationId", "==", registrationId).limit(1).get();
      if (!taxQ.empty) {
        transaction.update(taxQ.docs[0].ref, {
          status: 'cancelado',
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      return { success: true, refundAmount };
    });
  } catch (error: any) {
    console.error("Erro no estorno Admin:", error);
    return { success: false, error: error.message };
  }
}
