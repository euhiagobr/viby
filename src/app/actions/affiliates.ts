
"use server"

import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const firestore = getAdminDb();

/**
 * Gera um código numérico único de 10 dígitos.
 */
const generateUniqueCode = async (): Promise<string> => {
  let code = "";
  let isUnique = false;
  let attempts = 0;
  while (!isUnique && attempts < 10) {
    code = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const doc = await firestore.collection("affiliateCodes").doc(code).get();
    if (!doc.exists) {
      isUnique = true;
    }
    attempts++;
  }
  return code;
};

/**
 * Inicializa ou atualiza as estatísticas do afiliado.
 */
async function initializeAffiliateStats(db: any, userId: string, userName: string) {
  const statsRef = db.collection("affiliate_stats").doc(userId);
  const statsSnap = await statsRef.get();
  
  if (!statsSnap.exists) {
    await statsRef.set({
      userId: userId,
      userName: userName,
      totalTicketsSold: 0,
      totalUsersReferred: 0,
      totalOrgsLinked: 0,
      currentLevel: 0,
      balances: {
        BRL: { available: 0, pending: 0, totalEarned: 0, totalWithdrawn: 0 },
        USD: { available: 0, pending: 0, totalEarned: 0, totalWithdrawn: 0 },
        EUR: { available: 0, pending: 0, totalEarned: 0, totalWithdrawn: 0 }
      },
      updatedAt: FieldValue.serverTimestamp()
    });
  }
}

/**
 * Gera um código para um usuário específico (Manual Admin / Fallback).
 */
export async function generateAffiliateCodeAction(params: { userId: string }) {
  const { userId } = params;
  if (!userId) return { success: false, error: "Usuário não autenticado." };

  try {
    const userRef = firestore.collection("users").doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) throw new Error("Usuário não encontrado.");
    
    const userData = userDoc.data()!;
    if (userData.affiliateCode) {
      // Garante que o registro na coleção oficial exista
      const codeRef = firestore.collection("affiliateCodes").doc(userData.affiliateCode);
      const codeSnap = await codeRef.get();
      if (!codeSnap.exists) {
        await codeRef.set({
          code: userData.affiliateCode,
          userId: userId,
          userName: userData.name || userData.displayName || "Membro Viby",
          active: true,
          commissionType: "fixed",
          commissionValue: 0.50,
          createdAt: FieldValue.serverTimestamp()
        });
      }
      return { success: true, code: userData.affiliateCode };
    }

    const newCode = await generateUniqueCode();
    const userName = userData.name || userData.displayName || "Membro Viby";

    await userRef.update({ affiliateCode: newCode });

    await firestore.collection("affiliateCodes").doc(newCode).set({
      code: newCode,
      userId: userId,
      userName: userName,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      commissionType: "fixed",
      commissionValue: 0.50 
    });
    
    await initializeAffiliateStats(firestore, userId, userName);

    return { success: true, code: newCode };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Rotina de manutenção: garante que todos os usuários tenham código e que affiliateCodes esteja sincronizada.
 */
export async function generatePendingAffiliateCodesAction() {
  try {
    const usersSnapshot = await firestore.collection('users').get();
    let processedCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      let currentCode = userData.affiliateCode;

      // 1. Se não tem código no perfil, gera um novo
      if (!currentCode) {
        currentCode = await generateUniqueCode();
        await userDoc.ref.update({ affiliateCode: currentCode });
      }

      // 2. Garante que o documento na coleção oficial exista
      const codeRef = firestore.collection("affiliateCodes").doc(currentCode);
      const codeSnap = await codeRef.get();

      if (!codeSnap.exists) {
        const userName = userData.name || userData.displayName || "Membro Viby";
        await codeRef.set({
          code: currentCode,
          userId: userId,
          userName: userName,
          active: true,
          commissionType: "fixed",
          commissionValue: 0.50,
          createdAt: FieldValue.serverTimestamp(),
        });
        await initializeAffiliateStats(firestore, userId, userName);
        processedCount++;
      }
    }
    
    return { success: true, count: processedCount };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getAffiliatePublicRanking() {
  try {
    const statsSnap = await firestore.collection("affiliate_stats")
      .orderBy("totalTicketsSold", "desc")
      .limit(10)
      .get();

    const ranking = statsSnap.docs.map(d => ({
      id: d.id,
      name: d.data().userName || "Membro Viby",
      sales: d.data().totalTicketsSold || 0,
      level: d.data().currentLevel || 0
    }));

    return { success: true, ranking };
  } catch (e: any) {
    return { success: false, error: e.message, ranking: [] };
  }
}

export async function requestAffiliatePayout(params: {
  userId: string;
  amount: number;
  currency: string;
  pixKey?: string;
  pixType?: string;
  bankDetails?: string;
}) {
  const { userId, amount, currency, pixKey, pixType, bankDetails } = params;
  if (!userId || !amount || amount <= 0) return { success: false, error: "Dados inválidos." };

  try {
    return await firestore.runTransaction(async (transaction) => {
      const statsRef = firestore.collection("affiliate_stats").doc(userId);
      const statsSnap = await transaction.get(statsRef);

      if (!statsSnap.exists) throw new Error("Estatísticas não localizadas.");

      const stats = statsSnap.data()!;
      const balance = stats.balances?.[currency];

      if (!balance || (balance.available || 0) < amount) {
        throw new Error(`Saldo insuficiente em ${currency}.`);
      }

      const payoutRef = firestore.collection("affiliate_payouts").doc();
      transaction.set(payoutRef, {
        userId, amount, currency, pixKey: pixKey || null, pixType: pixType || null,
        bankDetails: bankDetails || null, status: "Pendente", createdAt: FieldValue.serverTimestamp()
      });

      transaction.update(statsRef, {
        [`balances.${currency}.available`]: FieldValue.increment(-amount),
        [`balances.${currency}.pending`]: FieldValue.increment(amount),
        updatedAt: FieldValue.serverTimestamp()
      });

      return { success: true };
    });
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
