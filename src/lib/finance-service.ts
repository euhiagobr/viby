'use client';

import { 
  Firestore, 
  doc, 
  runTransaction, 
  serverTimestamp, 
  collection,
  increment 
} from "firebase/firestore";
import { calculateRefundAmount, calculateRetainedGatewayFee } from "./financial-utils";

/**
 * @fileOverview Serviço client-side para processamento de estornos transacionais.
 * Executa toda a lógica financeira de forma atômica no navegador do usuário autenticado.
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
      
      // Se for gratuito, apenas cancela
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

      // Cálculo de Devolução (Regra: Total Pago - Taxa Gateway)
      const refundAmount = calculateRefundAmount(totalPaid);
      const retainedFee = calculateRetainedGatewayFee(totalPaid);

      // 1. Atualizar Registro do Ingresso
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

      // 2. Atualizar Saldo da Carteira (Ledger isolado)
      const walletRef = doc(db, "wallets", userId);
      transaction.set(walletRef, {
        balance: increment(refundAmount),
        updatedAt: serverTimestamp()
      }, { merge: true });

      // 3. Sincronizar campo legível no perfil
      const userRef = doc(db, "users", userId);
      transaction.update(userRef, {
        walletBalance: increment(refundAmount),
        updatedAt: serverTimestamp()
      });

      // 4. Registrar Transação no Ledger (wallet_transactions)
      const txRef = doc(collection(db, "wallet_transactions"));
      transaction.set(txRef, {
        userId,
        amount: refundAmount,
        type: 'credit',
        reason: 'ticket_refund',
        description: `Estorno: ${regData.eventTitle}`,
        metadata: {
          registrationId,
          eventId: regData.eventId,
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
        description: `Estorno de R$ ${refundAmount.toFixed(2)} para o usuário ${userId}. Motivo: ${reason}`,
        timestamp: serverTimestamp()
      });

      // 6. Atualizar Registro Fiscal se existir
      // Nota: Em transações client-side, buscas por query são limitadas. 
      // O registro fiscal será conciliado posteriormente no fechamento mensal do ERP.

      return { success: true, refundAmount, isFree: false };
    });
  } catch (error: any) {
    console.error("Erro na transação de estorno:", error);
    return { success: false, error: error.message };
  }
}