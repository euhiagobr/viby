'use server';

import { getAdminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';
import { revalidatePath } from 'next/cache';

/**
 * @fileOverview Server Actions para gestão e validação de campanhas da calculadora.
 * Implementa validação rígida de vigência temporal (UTC-3).
 */

export async function createSimulationCampaign(data: any) {
  const db = getAdminDb();
  try {
    const code = data.code.toUpperCase().trim();
    const existing = await db.collection('simulation_campaigns').where('code', '==', code).get();
    if (!existing.empty) throw new Error("Código já cadastrado.");

    const ref = db.collection('simulation_campaigns').doc();
    
    // Converte strings de input (local) para Timestamps (UTC) no Firestore
    const payload = {
      ...data,
      code,
      id: ref.id,
      startAt: data.startAt ? admin.firestore.Timestamp.fromDate(new Date(data.startAt)) : null,
      endAt: data.endAt ? admin.firestore.Timestamp.fromDate(new Date(data.endAt)) : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await ref.set(payload);
    revalidatePath('/admin/taxas-atracao');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateSimulationCampaign(id: string, data: any) {
  const db = getAdminDb();
  try {
    const payload = {
      ...data,
      startAt: data.startAt ? admin.firestore.Timestamp.fromDate(new Date(data.startAt)) : null,
      endAt: data.endAt ? admin.firestore.Timestamp.fromDate(new Date(data.endAt)) : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('simulation_campaigns').doc(id).update(payload);
    revalidatePath('/admin/taxas-atracao');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Validação exclusiva no Backend (Regra 8).
 * Verifica se o código existe, está ativo e dentro da janela de tempo.
 */
export async function validateSimulationCodeAction(code: string) {
  const db = getAdminDb();
  try {
    const cleanCode = code.trim().toUpperCase();
    const snap = await db.collection('simulation_campaigns')
      .where('code', '==', cleanCode)
      .where('active', '==', true)
      .limit(1)
      .get();

    if (snap.empty) {
      return { success: false, error: "Código não encontrado ou inativo." };
    }

    const campaign = snap.docs[0].data();
    const now = new Date(); // Server Time (UTC)

    const start = campaign.startAt?.toDate ? campaign.startAt.toDate() : new Date(campaign.startAt);
    const end = campaign.endAt?.toDate ? campaign.endAt.toDate() : new Date(campaign.endAt);

    if (now < start || now > end) {
      return { success: false, error: "Este código de simulação expirou." };
    }

    return { 
      success: true, 
      data: {
        orgPercent: campaign.orgFeePercent,
        orgMin: campaign.orgMinFee,
        buyerPercent: campaign.buyerFeePercent
      }
    };
  } catch (e: any) {
    return { success: false, error: "Falha na validação do servidor." };
  }
}

export async function deleteSimulationCampaign(id: string) {
  const db = getAdminDb();
  try {
    await db.collection('simulation_campaigns').doc(id).delete();
    revalidatePath('/admin/taxas-atracao');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function toggleSimulationCampaign(id: string, active: boolean) {
  const db = getAdminDb();
  try {
    await db.collection('simulation_campaigns').doc(id).update({
      active,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    revalidatePath('/admin/taxas-atracao');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
