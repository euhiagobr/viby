'use server';

import { getAdminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * @fileOverview Server Actions para operações financeiras transacionais utilizando o Admin SDK.
 */

/**
 * Processa o estorno de um ingresso para a carteira Viby utilizando privilégios de administrador.
 */
export async function processTicketRefund(registrationId: string, executorUid: string, reason: string) {
  try {
    const db = getAdminDb();
    
    return await db.runTransaction(async (transaction) => {
      const regRef = db.collection("registrations").doc(registrationId);
      const regSnap = await transaction.get(regRef);

      if (!regSnap.exists) throw new Error("Registro não encontrado.");
      const regData = regSnap.data()!;

      // --- VALIDAÇÃO DE SEGURANÇA NO SERVIDOR ---
      const userSnap = await transaction.get(db.collection("users").doc(executorUid));
      const isAdmin = userSnap.exists && userSnap.data()?.role === 'admin';
      
      const memberSnap = await transaction.get(
        db.collection("organizations").doc(regData.organizationId).collection("members").doc(executorUid)
      );
      const isOrgManager = memberSnap.exists && ['owner', 'admin', 'editor'].includes(memberSnap.data()?.role);

      if (!isAdmin && !isOrgManager) {
        throw new Error("Acesso negado para executar estorno.");
      }

      if (regData.status === 'cancelled' || regData.paymentStatus === 'refunded_wallet') {
        throw new Error("Este ingresso já foi estornado.");
      }

      if (regData.checkedIn) {
        throw new Error("Ingressos já utilizados não podem ser estornados.");
      }

      const ticketBasePrice = regData.ticketBasePrice || 0;
      const userId = regData.userId;

      if (!userId) throw new Error("Dono do ingresso não identificado.");

      // 1. Atualiza Registro do Ingresso
      transaction.update(regRef, {
        status: 'cancelled',
        paymentStatus: 'refunded_wallet',
        updatedAt: FieldValue.serverTimestamp(),
        cancelledAt: FieldValue.serverTimestamp(),
        cancelledBy: executorUid,
        cancelReason: reason,
        refundAmount: ticketBasePrice
      });

      // 2. Atualiza Saldo da Carteira (Ledger)
      const walletRef = db.collection("wallets").doc(userId);
      transaction.set(walletRef, {
        balance: FieldValue.increment(ticketBasePrice),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      // 3. Sincroniza walletBalance no perfil
      const userRef = db.collection("users").doc(userId);
      transaction.update(userRef, {
        walletBalance: FieldValue.increment(ticketBasePrice),
        updatedAt: FieldValue.serverTimestamp()
      });

      // 4. Registra Transação
      const txRef = db.collection("wallet_transactions").doc();
      transaction.set(txRef, {
        userId,
        amount: ticketBasePrice,
        type: 'credit',
        reason: 'ticket_refund',
        description: `Estorno Aprovado: ${regData.eventTitle}`,
        timestamp: FieldValue.serverTimestamp()
      });

      return { success: true, refundAmount: ticketBasePrice };
    });
  } catch (error: any) {
    console.error("Erro na transação de estorno:", error);
    return { success: false, error: error.message };
  }
}
