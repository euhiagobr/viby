
'use server';

import { getAdminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';
import { getAffiliateLevel } from '@/lib/affiliate-utils';

export async function requestAffiliatePayout(params: {
  userId: string;
  amount: number;
  pixKey: string;
  pixType: string;
}) {
  const db = getAdminDb();
  
  try {
    return await db.runTransaction(async (transaction) => {
      const statsRef = db.collection('affiliate_stats').doc(params.userId);
      const statsSnap = await transaction.get(statsRef);

      if (!statsSnap.exists) throw new Error("Conta de afiliado não localizada.");
      const stats = statsSnap.data()!;

      if (stats.balanceAvailable < params.amount) {
        throw new Error("Saldo disponível insuficiente.");
      }

      if (params.amount < 50) {
        throw new Error("O valor mínimo para saque é R$ 50,00.");
      }

      const payoutRef = db.collection('affiliate_payouts').doc();
      transaction.set(payoutRef, {
        userId: params.userId,
        amount: params.amount,
        pixKey: params.pixKey,
        pixType: params.pixType,
        status: 'Pendente',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      transaction.update(statsRef, {
        balanceAvailable: admin.firestore.FieldValue.increment(-params.amount),
        totalWithdrawn: admin.firestore.FieldValue.increment(params.amount),
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
        name: userData?.name || "Membro Viby",
        level: data.currentLevel,
        sales: data.totalTicketsSold,
        orgs: data.totalOrgsLinked
      };
    }));
    
    return { success: true, ranking: results };
  } catch (e) {
    return { success: false, ranking: [] };
  }
}
