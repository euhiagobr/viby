'use server';

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, collection, addDoc, serverTimestamp, runTransaction, increment } from "firebase/firestore";
import { firebaseConfig } from "@/firebase/config";

/**
 * @fileOverview Server Actions para operações financeiras transacionais utilizando o SDK padrão.
 */

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app, "eventosviby");

/**
 * Processa o estorno de um ingresso para a carteira Viby.
 */
export async function processTicketRefund(registrationId: string, executorUid: string, reason: string) {
  try {
    return await runTransaction(db, async (transaction) => {
      const regRef = doc(db, "registrations", registrationId);
      const regSnap = await transaction.get(regRef);

      if (!regSnap.exists()) throw new Error("Registro não encontrado.");
      const regData = regSnap.data()!;

      // --- VALIDAÇÃO DE SEGURANÇA ---
      const userSnap = await transaction.get(doc(db, "users", executorUid));
      const isAdmin = userSnap.exists() && userSnap.data()?.role === 'admin';
      
      const memberSnap = await transaction.get(
        doc(db, "organizations", regData.organizationId, "members", executorUid)
      );
      const isOrgManager = memberSnap.exists() && ['owner', 'admin', 'editor'].includes(memberSnap.data()?.role);

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
        updatedAt: serverTimestamp(),
        cancelledAt: serverTimestamp(),
        cancelledBy: executorUid,
        cancelReason: reason,
        refundAmount: ticketBasePrice
      });

      // 2. Atualiza Saldo da Carteira (Ledger)
      const walletRef = doc(db, "wallets", userId);
      transaction.set(walletRef, {
        balance: increment(ticketBasePrice),
        updatedAt: serverTimestamp()
      }, { merge: true });

      // 3. Sincroniza walletBalance no perfil
      const userRef = doc(db, "users", userId);
      transaction.update(userRef, {
        walletBalance: increment(ticketBasePrice),
        updatedAt: serverTimestamp()
      });

      // 4. Registra Transação
      const txRef = doc(collection(db, "wallet_transactions"));
      transaction.set(txRef, {
        userId,
        amount: ticketBasePrice,
        type: 'credit',
        reason: 'ticket_refund',
        description: `Estorno Aprovado: ${regData.eventTitle}`,
        timestamp: serverTimestamp()
      });

      return { success: true, refundAmount: ticketBasePrice };
    });
  } catch (error: any) {
    console.error("Erro na transação de estorno:", error);
    return { success: false, error: error.message };
  }
}
