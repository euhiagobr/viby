'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { revalidatePath } from 'next/cache';

/**
 * @fileOverview Server Actions para gestão segura de Viby Ads.
 */

export async function createAdAction(params: {
  orgId: string;
  userId: string;
  title: string;
  type: string;
  dailyBudget: number;
  startDate: string;
  endDate: string;
  eventId?: string | null;
  externalUrl?: string | null;
  adImage?: string | null;
}) {
  const db = getAdminDb();
  
  try {
    return await db.runTransaction(async (transaction) => {
      const orgRef = db.collection('organizations').doc(params.orgId);
      const orgSnap = await transaction.get(orgRef);

      if (!orgSnap.exists) throw new Error("Organização não encontrada.");
      
      const orgData = orgSnap.data()!;
      
      const start = new Date(params.startDate);
      const end = new Date(params.endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const durationDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      const totalBudget = params.dailyBudget * durationDays;

      if ((orgData.adBalance || 0) < totalBudget) {
        throw new Error("Saldo Ads insuficiente para esta campanha.");
      }

      const needsApproval = params.type === 'banner' || params.type === 'site';

      const adRef = db.collection('ads').doc();
      const adData = {
        id: adRef.id,
        organizationId: params.orgId,
        organizerId: params.userId,
        eventTitle: params.title,
        type: params.type,
        eventId: params.eventId || null,
        externalUrl: params.externalUrl || null,
        adImage: params.adImage || null,
        status: needsApproval ? 'Pendente' : 'Ativo',
        approved: !needsApproval,
        dailyBudget: params.dailyBudget,
        initialBudget: totalBudget,
        remainingBudget: totalBudget,
        budget: totalBudget,
        durationDays,
        startDate: admin.firestore.Timestamp.fromDate(start),
        endDate: admin.firestore.Timestamp.fromDate(end),
        reach: 0,
        uniqueReach: 0,
        clicks: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      transaction.set(adRef, adData);
      transaction.update(orgRef, {
        adBalance: admin.firestore.FieldValue.increment(-totalBudget),
        blockedBalance: admin.firestore.FieldValue.increment(totalBudget),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const taxRef = db.collection('tax_ads').doc();
      transaction.set(taxRef, {
        adId: adRef.id,
        orgId: params.orgId,
        orgName: orgData.name,
        grossValue: totalBudget,
        status: 'pendente',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, adId: adRef.id };
    });
  } catch (e: any) {
    console.error("[Ads Action] Create Failure:", e.message);
    return { success: false, error: e.message };
  }
}

export async function updateAdAction(params: {
  adId: string;
  title: string;
  externalUrl?: string | null;
  adImage?: string | null;
}) {
  const db = getAdminDb();
  try {
    const adRef = db.collection('ads').doc(params.adId);
    const adSnap = await adRef.get();
    
    if (!adSnap.exists) throw new Error("Anúncio não encontrado.");
    const adData = adSnap.data()!;

    // Regra: banner e site voltam para aprovação. Evento e Pagina não.
    const needsApproval = adData.type === 'banner' || adData.type === 'site';

    await adRef.update({
      eventTitle: params.title,
      externalUrl: params.externalUrl || null,
      adImage: params.adImage || null,
      status: needsApproval ? 'Pendente' : 'Ativo',
      approved: !needsApproval,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function moderateAdAction(adId: string, status: 'Ativo' | 'Rejeitado', adminUid: string) {
  const db = getAdminDb();
  
  try {
    const adRef = db.collection('ads').doc(adId);
    await adRef.update({
      status,
      approved: status === 'Ativo',
      moderatedBy: adminUid,
      moderatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
