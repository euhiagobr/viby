'use server';

import * as admin from 'firebase-admin';
import { firebaseConfig } from '@/firebase/config';

/**
 * @fileOverview Server Actions para operações financeiras transacionais (Ledger).
 * Utiliza o Firebase Admin SDK para garantir atomicidade e bypass de Security Rules,
 * com validação manual de autorização.
 */

// Inicializa o Firebase Admin para o banco de dados específico 'eventosviby'
function getVibyDb() {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
  }
  return admin.firestore();
}

/**
 * Processa o estorno de um ingresso para a carteira Viby.
 * RESTRITO: Apenas organizadores ou admins podem EXECUTAR o estorno.
 */
export async function processTicketRefund(registrationId: string, executorUid: string, reason: string) {
  const db = getVibyDb();
  
  try {
    return await db.runTransaction(async (transaction) => {
      const regRef = db.collection("registrations").doc(registrationId);
      const regSnap = await transaction.get(regRef);

      if (!regSnap.exists) throw new Error("Registro não encontrado.");
      const regData = regSnap.data()!;

      // --- VALIDAÇÃO DE SEGURANÇA MANUAL ---
      const userSnap = await transaction.get(db.collection("users").doc(executorUid));
      const isAdmin = userSnap.exists && userSnap.data()?.role === 'admin';
      
      const memberSnap = await transaction.get(
        db.collection("organizations").doc(regData.organizationId).collection("members").doc(executorUid)
      );
      const isOrgManager = memberSnap.exists && ['owner', 'admin', 'editor'].includes(memberSnap.data()?.role);

      // Trava: O próprio comprador NÃO PODE executar o estorno (apenas solicitar)
      if (!isAdmin && !isOrgManager) {
        throw new Error("Apenas o organizador do evento ou administradores podem aprovar estornos.");
      }

      // --- VALIDAÇÃO DE STATUS ---
      if (regData.status === 'cancelled' || regData.paymentStatus === 'refunded_wallet') {
        throw new Error("Este ingresso já foi estornado ou cancelado.");
      }

      if (regData.checkedIn) {
        throw new Error("Ingressos já utilizados não podem ser estornados.");
      }

      const totalPaid = regData.price || 0;
      const ticketBasePrice = regData.ticketBasePrice || 0;

      if (totalPaid <= 0) {
        transaction.update(regRef, {
          status: 'cancelled',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
          cancelledBy: executorUid,
          cancelReason: reason
        });
        return { success: true, isFree: true };
      }

      // Devolução do Valor de Face (ticketBasePrice)
      const refundAmount = ticketBasePrice;
      const userId = regData.userId;

      if (!userId) throw new Error("Dono do ingresso não identificado.");

      // 1. Atualiza Registro do Ingresso
      transaction.update(regRef, {
        status: 'cancelled',
        paymentStatus: 'refunded_wallet',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        cancelledBy: executorUid,
        cancelReason: reason,
        refundAmount: refundAmount,
        refundStatus: 'approved'
      });

      // 2. Atualiza Saldo da Carteira (Ledger)
      const walletRef = db.collection("wallets").doc(userId);
      transaction.set(walletRef, {
        balance: admin.firestore.FieldValue.increment(refundAmount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // 3. Sincroniza walletBalance no perfil do usuário
      const userRef = db.collection("users").doc(userId);
      transaction.update(userRef, {
        walletBalance: admin.firestore.FieldValue.increment(refundAmount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 4. Registra Transação no Ledger (wallet_transactions)
      const txRef = db.collection("wallet_transactions").doc();
      transaction.set(txRef, {
        userId,
        amount: refundAmount,
        type: 'credit',
        reason: 'ticket_refund',
        description: `Estorno Aprovado: ${regData.eventTitle}`,
        metadata: {
          registrationId,
          eventId: regData.eventId,
          totalPaidAtPurchase: totalPaid,
          ticketBasePrice: ticketBasePrice,
          executorUid
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // 5. Atualiza Registro Fiscal (tax_tickets) se existir
      const taxQuery = db.collection("tax_tickets").where("registrationId", "==", registrationId).limit(1);
      const taxDocs = await taxQuery.get();
      if (!taxDocs.empty) {
        transaction.update(taxDocs.docs[0].ref, {
          nfStatus: 'cancelado',
          status: 'cancelado',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // 6. Log de Auditoria
      const auditRef = db.collection("financial_logs").doc();
      transaction.set(auditRef, {
        action: 'refund',
        category: 'payout',
        userId: executorUid,
        targetId: registrationId,
        description: `Estorno aprovado pelo organizador ${executorUid} para o usuário ${userId}. Valor: ${refundAmount}.`,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, refundAmount };
    });
  } catch (error: any) {
    console.error("Erro na transação de estorno:", error);
    return { success: false, error: error.message };
  }
}
