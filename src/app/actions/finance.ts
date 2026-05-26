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
  // No Firebase Admin SDK, o acesso a bancos nomeados é feito através da instância do Firestore
  return admin.firestore().databaseId === 'eventosviby' 
    ? admin.firestore() 
    : admin.firestore(); // Em ambientes de protótipo, usamos a instância padrão ou configurada via env
}

/**
 * Processa o estorno de um ingresso para a carteira Viby.
 * Segue a regra de retenção de taxa financeira (4.99% + R$ 1,00).
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
      // Verificamos se o executor tem permissão para realizar esta ação
      const isOwner = regData.userId === executorUid;
      
      let isAuthorized = isOwner;

      if (!isAuthorized) {
        // Verifica se o executor é admin global
        const userSnap = await transaction.get(db.collection("users").doc(executorUid));
        if (userSnap.exists && userSnap.data()?.role === 'admin') {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        // Verifica se o executor é admin/owner da organização do evento
        const memberSnap = await transaction.get(
          db.collection("organizations").doc(regData.organizationId).collection("members").doc(executorUid)
        );
        if (memberSnap.exists && ['owner', 'admin'].includes(memberSnap.data()?.role)) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) throw new Error("Você não tem permissão para realizar este estorno.");

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
        // Ingresso gratuito: apenas cancela
        transaction.update(regRef, {
          status: 'cancelled',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
          cancelledBy: executorUid,
          cancelReason: reason
        });
        return { success: true, isFree: true };
      }

      // Cálculo de Devolução (Regra: Valor Nominal do Ingresso)
      // O sistema devolve o ticketBasePrice para o usuário.
      // A taxa administrativa fica com a plataforma.
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
        refundAmount: refundAmount
      });

      // 2. Atualiza Saldo da Carteira (Coleção wallets)
      const walletRef = db.collection("wallets").doc(userId);
      transaction.set(walletRef, {
        balance: admin.firestore.FieldValue.increment(refundAmount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // 3. Legado/Compatibilidade: Sincroniza walletBalance no perfil do usuário
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
        description: `Estorno: ${regData.eventTitle}`,
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
        description: `Estorno realizado para o usuário ${userId}. Valor: ${refundAmount}. Motivo: ${reason}`,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, refundAmount };
    });
  } catch (error: any) {
    console.error("Erro na transação de estorno:", error);
    return { success: false, error: error.message };
  }
}
