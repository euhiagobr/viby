
'use server';

import { getAdminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';
import { revalidatePath } from 'next/cache';

export async function createSimulationCampaign(data: any) {
  const db = getAdminDb();
  try {
    const code = data.code.toUpperCase().trim();
    const existing = await db.collection('simulation_campaigns').where('code', '==', code).get();
    if (!existing.empty) throw new Error("Código já cadastrado.");

    const ref = db.collection('simulation_campaigns').doc();
    await ref.set({
      ...data,
      code,
      id: ref.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    revalidatePath('/admin/taxas-atracao');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateSimulationCampaign(id: string, data: any) {
  const db = getAdminDb();
  try {
    await db.collection('simulation_campaigns').doc(id).update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    revalidatePath('/admin/taxas-atracao');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
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
