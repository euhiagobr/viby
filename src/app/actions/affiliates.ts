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
  while (!isUnique) {
    code = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const doc = await firestore.collection("affiliateCodes").doc(code).get();
    if (!doc.exists) {
      isUnique = true;
    }
  }
  return code;
};

/**
 * Cria a estrutura inicial de estatísticas para um novo afiliado.
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

export async function generateAffiliateCodeAction(params: { userId: string }) {
  const { userId } = params;
  if (!userId) return { success: false, error: "Usuário não autenticado." };

  try {
    const userRef = firestore.collection("users").doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    if (!userDoc.exists || !userData) throw new Error("Usuário não encontrado.");
    if (userData.affiliateCode) throw new Error("Usuário já possui um código de afiliado.");

    const newCode = await generateUniqueCode();
    const userName = userData.name || userData.displayName || "Membro Viby";

    await userRef.update({ affiliateCode: newCode });

    await firestore.collection("affiliateCodes").doc(newCode).set({
      code: newCode,
      userId: userId,
      userName: userName,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      commissionType: "default",
      commissionValue: 0.50 
    });
    
    await initializeAffiliateStats(firestore, userId, userName);

    return { success: true, code: newCode };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function generatePendingAffiliateCodesAction() {
  try {
    const usersSnapshot = await firestore.collection('users').get();
    let processedCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      if (!userData.affiliateCode) {
        const newCode = await generateUniqueCode();
        const userName = userData.name || userData.displayName || "Membro Viby";
        
        await userDoc.ref.update({ affiliateCode: newCode });

        await firestore.collection("affiliateCodes").doc(newCode).set({
          code: newCode,
          userId: userDoc.id,
          userName: userName,
          active: true,
          createdAt: FieldValue.serverTimestamp(),
        });

        await initializeAffiliateStats(firestore, userDoc.id, userName);
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
