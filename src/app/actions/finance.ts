
'use server';

import { doc, runTransaction, serverTimestamp, collection, increment, getDoc, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { calculateRefundAmount, calculateRetainedGatewayFee } from '@/lib/financial-utils';
import { recordAuditLog } from './audit';

/**
 * @fileOverview Server Actions para operações financeiras utilizando o Client SDK de forma isomórfica.
 */

async function getDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

export async function processTicketRefund(registrationId: string, executorUid: string, reason: string) {
  try {
    const db = await getDb();
    
    const result = await runTransaction(db, async (transaction) => {
      const regRef = doc(db, "registrations", registrationId);
      const regSnap = await transaction.get(regRef);

      if (!regSnap.exists()) throw new Error("Registro não encontrado.");
      const regData = regSnap.data()!;

      // Validação de Segurança
      const userSnap = await transaction.get(doc(db, "users", executorUid));
      const isAdmin = userSnap.exists() && userSnap.data()?.role === 'admin';
      
      const memberSnap = await transaction.get(
        doc(db, "organizations", regData.organizationId, "members", executorUid)
      );
      const isOrgManager = memberSnap.exists() && ['owner', 'admin', 'editor'].includes(memberSnap.data()?.role);

      if (!isAdmin && !isOrgManager) throw new Error("Acesso negado.");
      if (regData.status === 'cancelled') throw new Error("Já estornado.");
      if (regData.checkedIn) throw new Error("Ingresso já utilizado.");

      const userId = regData.userId;
      const totalPaid = regData.price || 0;
      const eventId = regData.eventId;
      const occurrenceId = regData.occurrenceId;

      // 1. Devolução de Capacidade
      if (occurrenceId) {
        const occRef = doc(db, "recurring_occurrences", occurrenceId);
        const occSnap = await transaction.get(occRef);
        if (occSnap.exists() && (occSnap.data()?.ingressosVendidos || 0) > 0) {
          transaction.update(occRef, { 
            ingressosVendidos: increment(-1),
            updatedAt: serverTimestamp() 
          });
        }
      }
      
      const eventRef = doc(db, "events", eventId);
      const eventSnap = await transaction.get(eventRef);
      if (eventSnap.exists() && (eventSnap.data()?.ingressosVendidos || 0) > 0) {
        transaction.update(eventRef, { 
          ingressosVendidos: increment(-1),
          updatedAt: serverTimestamp() 
        });
      }

      // Se for gratuito
      if (totalPaid <= 0) {
        transaction.update(regRef, {
          status: 'cancelled',
          cancelledAt: serverTimestamp(),
          cancelledBy: executorUid,
          cancelReason: reason
        });
        return { success: true, isFree: true, orgId: regData.organizationId, eventId: regData.eventId };
      }

      const refundAmount = calculateRefundAmount(totalPaid);
      const retainedFee = calculateRetainedGatewayFee(totalPaid);

      // 2. Atualizar Registro do Ingresso
      transaction.update(regRef, {
        status: 'cancelled',
        paymentStatus: 'refunded_wallet',
        cancelledAt: serverTimestamp(),
        cancelledBy: executorUid,
        cancelReason: reason,
        refundAmount: refundAmount,
        retainedFee: retainedFee,
        updatedAt: serverTimestamp()
      });

      // 3. Devolução para Carteira
      const walletRef = doc(db, "wallets", userId);
      transaction.set(walletRef, {
        balance: increment(refundAmount),
        updatedAt: serverTimestamp()
      }, { merge: true });

      const userRef = doc(db, "users", userId);
      transaction.update(userRef, {
        walletBalance: increment(refundAmount),
        updatedAt: serverTimestamp()
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
