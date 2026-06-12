
'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { PartnerTier, validatePartnerTiers } from '@/lib/partner-utils';
import { revalidatePath } from 'next/cache';

/**
 * @fileOverview Server Actions para gestão do módulo de Parceiros.
 */

async function logPartnerAction(action: string, userId: string, partnerId?: string, metadata?: any) {
  const db = getAdminDb();
  await db.collection('partner_logs').add({
    action,
    userId,
    partnerId: partnerId || null,
    metadata: metadata || null,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
}

export async function createPartnerAction(params: {
  userId: string;
  code: string;
  adminUid: string;
}) {
  const db = getAdminDb();
  const { userId, code, adminUid } = params;

  try {
    const codeNormalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]+$/.test(codeNormalized)) throw new Error("Código deve conter apenas letras e números.");

    return await db.runTransaction(async (transaction) => {
      // 1. Verificar se o código já existe
      const codeCheck = await transaction.get(db.collection('partners').where('code', '==', codeNormalized).limit(1));
      if (!codeCheck.empty) throw new Error("Este código já está em uso por outro parceiro.");

      // 2. Buscar dados do usuário
      const userRef = db.collection('users').doc(userId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new Error("Usuário não encontrado.");
      const userData = userSnap.data()!;

      // 3. Criar registro de parceiro
      const partnerRef = db.collection('partners').doc(userId);
      const existingPartner = await transaction.get(partnerRef);
      if (existingPartner.exists) throw new Error("Este usuário já é um parceiro.");

      const partnerData = {
        id: userId,
        name: userData.name || userData.displayName || "Membro Viby",
        email: userData.email,
        code: codeNormalized,
        status: 'active',
        tiers: [
          { min: 0, max: 19.99, value: 1.00 },
          { min: 20.00, max: 49.99, value: 2.00 },
          { min: 50.00, max: null, value: 5.00 }
        ],
        stats: {
          pendingBalance: 0,
          availableBalance: 0,
          totalEarned: 0,
          referralsCount: 0,
          salesCount: 0
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      transaction.set(partnerRef, partnerData);
      transaction.update(userRef, { isPartner: true, partnerCode: codeNormalized });

      return { success: true };
    });
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updatePartnerTiersAction(params: {
  partnerId: string;
  tiers: PartnerTier[];
  adminUid: string;
}) {
  const db = getAdminDb();
  const validation = validatePartnerTiers(params.tiers);
  if (!validation.valid) return { success: false, error: validation.error };

  try {
    await db.collection('partners').doc(params.partnerId).update({
      tiers: params.tiers,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await logPartnerAction('update_tiers', params.adminUid, params.partnerId, { tiers: params.tiers });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function togglePartnerStatusAction(partnerId: string, status: 'active' | 'inactive', adminUid: string) {
  const db = getAdminDb();
  try {
    await db.collection('partners').doc(partnerId).update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await logPartnerAction(status === 'active' ? 'reactivate' : 'suspend', adminUid, partnerId);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function usePartnerCodeAction(userId: string, code: string) {
  const db = getAdminDb();
  const codeNormalized = code.trim().toUpperCase();

  try {
    return await db.runTransaction(async (transaction) => {
      // 1. Verificar se usuário já tem parceiro
      const refCheck = db.collection('partner_referrals').doc(userId);
      const refSnap = await transaction.get(refCheck);
      if (refSnap.exists) throw new Error("Usuário já possui um parceiro vinculado.");

      // 2. Localizar parceiro pelo código
      const partnerQ = db.collection('partners').where('code', '==', codeNormalized).where('status', '==', 'active').limit(1);
      const partnerSnap = await transaction.get(partnerQ);
      if (partnerSnap.empty) throw new Error("Código de parceiro inválido ou inativo.");
      
      const partner = partnerSnap.docs[0];
      const partnerId = partner.id;

      const now = new Date();
      const expiresAt = new Date();
      expiresAt.setFullYear(now.getFullYear() + 1);

      transaction.set(refCheck, {
        partnerId,
        referredUserId: userId,
        referredAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        status: 'active'
      });

      transaction.update(partner.ref, {
        "stats.referralsCount": admin.firestore.FieldValue.increment(1)
      });

      return { success: true, partnerName: partner.data().name };
    });
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
