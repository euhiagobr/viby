'use client';

import { 
  Firestore, 
  doc, 
  runTransaction, 
  serverTimestamp, 
  collection,
  increment,
  query,
  where,
  getDocs,
  limit
} from "firebase/firestore";
import { calculateRefundAmount, calculateRetainedGatewayFee } from "./financial-utils";

/**
 * @fileOverview Serviço client-side para processamento de estornos transacionais.
 * Gerencia a devolução de saldo para a carteira e retorno de capacidade para o evento.
 * ATUALIZADO: Proteção contra contadores negativos e sincronização pai-filho.
 */

export async function processTicketRefundClient(
  db: Firestore, 
  registrationId: string, 
  executorUid: string, 
  reason: string
) {
  const regRef = doc(db, "registrations", registrationId);

  try {
    return await runTransaction(db, async (transaction) => {
      const regSnap = await transaction.get(regRef);
      if (!regSnap.exists()) throw new Error("Registro não encontrado.");
      
      const regData = regSnap.data();
      if (regData.status === 'cancelled' || regData.paymentStatus === 'refunded_wallet') {
        throw new Error("Este ingresso já foi estornado.");
      }
      if (regData.checkedIn) {
        throw new Error("Ingressos já utilizados não podem ser estornados.");
      }

      const userId = regData.userId;
      const totalPaid = regData.price || 0;
      const eventId = regData.eventId;
      const occurrenceId = regData.occurrenceId;

      // 1. Devolução de Capacidade (Inventário) - PROTEÇÃO CONTRA NEGATIVOS
      if (occurrenceId) {
        const occRef = doc(db, "recurring_occurrences", occurrenceId);
        const occSnap = await transaction.get(occRef);
        if (occSnap.exists() && (occSnap.data().ingressosVendidos || 0) > 0) {
          transaction.update(occRef, { 
            ingressosVendidos: increment(-1),
            updatedAt: serverTimestamp()
          });
        }
      }
      
      const eventRef = doc(db, "events", eventId);
      const eventSnap = await transaction.get(eventRef);
      if (eventSnap.exists() && (eventSnap.data().ingressosVendidos || 0) > 0) {
        transaction.update(eventRef, { 
          ingressosVendidos: increment(-1),
          updatedAt: serverTimestamp()
        });
      }

      // Se for gratuito, encerra aqui após atualizar inventário
      if (totalPaid <= 0) {
        transaction.update(regRef, {
          status: 'cancelled',
          updatedAt: serverTimestamp(),
          cancelledAt: serverTimestamp(),
          cancelledBy: executorUid,
          cancelReason: reason
        });
        return { success: true, isFree: true };
      }

      // Cálculo de Devolução
      const refundAmount = calculateRefundAmount(totalPaid);
      const retainedFee = calculateRetainedGatewayFee(totalPaid);

      // 2. Atualizar Registro do Ingresso
      transaction.update(regRef, {
        status: 'cancelled',
        paymentStatus: 'refunded_wallet',
        updatedAt: serverTimestamp(),
        cancelledAt: serverTimestamp(),
        cancelledBy: executorUid,
        cancelReason: reason,
        refundAmount: refundAmount,
        retainedFee: retainedFee
      });

      // 3. Devolução Financeira (Carteira)
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

      // 4. Registrar Transação no Ledger
      const txRef = doc(collection(db, "wallet_transactions"));
      transaction.set(txRef, {
        userId,
        amount: refundAmount,
        type: 'credit',
        reason: 'ticket_refund',
        description: `Estorno: ${regData.eventTitle}`,
        metadata: {
          registrationId,
          eventId,
          totalPaid,
          gatewayFeeRetained: retainedFee,
          executorUid
        },
        timestamp: serverTimestamp()
      });

      // 5. Log de Auditoria
      const auditRef = doc(collection(db, "financial_logs"));
      transaction.set(auditRef, {
        action: 'refund',
        category: 'payout',
        userId: executorUid,
        targetId: registrationId,
        description: `Estorno de R$ ${refundAmount.toFixed(2)} devolvido.`,
        timestamp: serverTimestamp()
      });

      return { success: true, refundAmount, isFree: false };
    });
  } catch (error: any) {
    console.error("Erro na transação de estorno:", error);
    return { success: false, error: error.message };
  }
}
