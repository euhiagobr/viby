
'use server';

import { getAdminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';
import { CurrencyCode } from '@/contexts/CurrencyContext';

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

      // Valores mínimos variam conforme moeda (exemplo simplificado)
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

      // Atualiza o saldo específico da moeda
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
        name: userData?.name || "Membro Viby",
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
