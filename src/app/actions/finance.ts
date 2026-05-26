'use server';

import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  runTransaction, 
  serverTimestamp, 
  collection, 
  increment 
} from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { calculateRefundAmount, calculateRetainedGatewayFee } from '@/lib/financial-utils';

/**
 * @fileOverview Server Actions para operações financeiras transacionais (Ledger).
 */

async function getDb() {
  const app = getApps().find(a => a.name === "[DEFAULT]") || initializeApp(firebaseConfig);
  return getFirestore(app, 'eventosviby');
}

/**
 * Processa o estorno de um ingresso para a carteira Viby.
 * Segue a regra de retenção de taxa financeira (4.99% + R$ 1,00).
 */
export async function processTicketRefund(registrationId: string, executorUid: string, reason: string) {
  const db = await getDb();
  
  try {
    return await runTransaction(db, async (transaction) => {
      const regRef = doc(db, "registrations", registrationId);
      const regSnap = await transaction.get(regRef);

      if (!regSnap.exists()) throw new Error("Registro não encontrado.");
      const regData = regSnap.data();

      if (regData.status === 'cancelled' || regData.paymentStatus === 'refunded_wallet') {
        throw new Error("Este ingresso já foi estornado ou cancelado.");
      }

      if (regData.checkedIn) {
        throw new Error("Ingressos já utilizados não podem ser estornados.");
      }

      const totalPaid = regData.price || 0;
      if (totalPaid <= 0) {
        // Ingresso gratuito: apenas cancela
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
      const userId = regData.userId;

      if (!userId) throw new Error("Dono do ingresso não identificado.");

      // 1. Atualiza Registro do Ingresso
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

      // 2. Atualiza Saldo da Carteira (Coleção wallets)
      const walletRef = doc(db, "wallets", userId);
      transaction.set(walletRef, {
        balance: increment(refundAmount),
        updatedAt: serverTimestamp()
      }, { merge: true });

      // 3. Legado: Sincroniza walletBalance no perfil do usuário para compatibilidade visual
      const userRef = doc(db, "users", userId);
      transaction.update(userRef, {
        walletBalance: increment(refundAmount),
        updatedAt: serverTimestamp()
      });

      // 4. Registra Transação no Ledger (wallet_transactions)
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
          totalPaidBeforeRefund: totalPaid,
          gatewayFeeRetained: retainedFee,
          executorUid
        },
        timestamp: serverTimestamp()
      });

      // 5. Registra Log de Auditoria
      const auditRef = doc(collection(db, "financial_logs"));
      transaction.set(auditRef, {
        action: 'refund',
        category: 'payout',
        userId: executorUid,
        targetId: registrationId,
        description: `Estorno realizado para o usuário ${userId}. Valor: ${refundAmount}. Motivo: ${reason}`,
        timestamp: serverTimestamp()
      });

      return { success: true, refundAmount, retainedFee };
    });
  } catch (error: any) {
    console.error("Erro na transação de estorno:", error);
    return { success: false, error: error.message };
  }
}
