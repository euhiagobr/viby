
'use server';

import { getAdminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';
import { CurrencyCode } from '@/contexts/CurrencyContext';
import { generateAffiliateCode } from '@/lib/affiliate-utils';

export async function requestAffiliatePayout(params: {
  userId: string;
  amount: number;
  currency: CurrencyCode;
  pixKey: string;
  pixType: string;
  bankDetails?: string;
}) {
  const db = getAdminDb();
  
  try {
    return await db.runTransaction(async (transaction) => {
      const statsRef = db.collection('affiliate_stats').doc(params.userId);
      const statsSnap = await transaction.get(statsRef);

      if (!statsSnap.exists) throw new Error("Conta de afiliado não localizada.");
      const stats = statsSnap.data()!;
      const currency = params.currency || 'BRL';

      const balanceData = stats.balances?.[currency] || { available: 0 };

      if (balanceData.available < params.amount) {
        throw new Error(`Saldo disponível em ${currency} insuficiente.`);
      }

      const minAmount = currency === 'BRL' ? 50 : 20;
      if (params.amount < minAmount) {
        throw new Error(`O valor mínimo para saque em ${currency} é ${minAmount}.`);
      }

      const payoutRef = db.collection('affiliate_payouts').doc();
      transaction.set(payoutRef, {
        userId: params.userId,
        amount: params.amount,
        currency: currency,
        pixKey: params.pixKey,
        pixType: params.pixType,
        bankDetails: params.bankDetails || "",
        status: 'Pendente',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      transaction.update(statsRef, {
        [`balances.${currency}.available`]: admin.firestore.FieldValue.increment(-params.amount),
        [`balances.${currency}.totalWithdrawn`]: admin.firestore.FieldValue.increment(params.amount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true };
    });
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getAffiliatePublicRanking() {
  const db = getAdminDb();
  try {
    const snap = await db.collection('affiliate_stats')
      .orderBy('totalTicketsSold', 'desc')
      .limit(10)
      .get();
      
    const results = await Promise.all(snap.docs.map(async (d) => {
      const data = d.data();
      const userSnap = await db.collection('users').doc(data.userId).get();
      const userData = userSnap.data();
      
      return {
        name: userData?.name || userData?.displayName || "Membro Viby",
        level: data.currentLevel || 0,
        sales: data.totalTicketsSold || 0,
        orgs: data.totalOrgsLinked || 0
      };
    }));
    
    return { success: true, ranking: results };
  } catch (e) {
    return { success: false, ranking: [] };
  }
}

/**
 * Gera códigos de afiliado de 10 dígitos para usuários que ainda não possuem.
 */
export async function generatePendingAffiliateCodesAction() {
  const db = getAdminDb();
  try {
    const usersSnap = await db.collection('users').get();
    
    // Filtragem manual para maior precisão (caso campos estejam undefined)
    const targets = usersSnap.docs.filter(d => !d.data().affiliateCode);
    
    if (targets.length === 0) return { success: true, count: 0 };

    let count = 0;
    const batch = db.batch();

    for (const userDoc of targets) {
      const newCode = await getUniqueAffiliateCode(db);
      batch.update(userDoc.ref, { 
        affiliateCode: newCode,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Criar índice de usernames
      const usernameRef = db.collection('usernames').doc(newCode);
      batch.set(usernameRef, {
        uid: userDoc.id,
        type: 'user',
        username: newCode
      });

      count++;
      
      // Batch limit
      if (count >= 400) break;
    }

    await batch.commit();
    return { success: true, count };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Reprocessa um usuário específico para garantir que tenha código de afiliado.
 */
export async function reprocessUserAffiliateAction(uid: string) {
  const db = getAdminDb();
  try {
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new Error("Usuário não encontrado.");

    if (userSnap.data()?.affiliateCode) {
      return { success: true, message: "Usuário já possui código." };
    }

    const newCode = await getUniqueAffiliateCode(db);
    const batch = db.batch();
    
    batch.update(userRef, { 
      affiliateCode: newCode,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const usernameRef = db.collection('usernames').doc(newCode);
    batch.set(usernameRef, {
      uid: uid,
      type: 'user',
      username: newCode
    });

    await batch.commit();
    return { success: true, code: newCode };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

async function getUniqueAffiliateCode(db: admin.firestore.Firestore): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const code = generateAffiliateCode();
    const snap = await db.collection('users').where('affiliateCode', '==', code).limit(1).get();
    if (snap.empty) return code;
    attempts++;
  }
  throw new Error("Falha ao gerar código único após 10 tentativas.");
}
