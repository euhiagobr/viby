
'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';

/**
 * @fileOverview Server Actions para gestão do cardápio nativo.
 * Tratamento de datas em UTC para compatibilidade global.
 */

// --- GESTÃO DE SEÇÕES ---

export async function createMenuSectionAction(orgId: string, data: { nome: string; ordem: number }) {
  const db = getAdminDb();
  try {
    const sectionRef = db.collection('organizations').doc(orgId).collection('menu_sections').doc();
    await sectionRef.set({
      ...data,
      id: sectionRef.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, id: sectionRef.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateMenuSectionAction(orgId: string, sectionId: string, data: any) {
  const db = getAdminDb();
  try {
    await db.collection('organizations').doc(orgId).collection('menu_sections').doc(sectionId).update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteMenuSectionAction(orgId: string, sectionId: string) {
  const db = getAdminDb();
  try {
    // Nota: Itens vinculados a esta seção devem ser tratados (ex: movidos ou deletados)
    await db.collection('organizations').doc(orgId).collection('menu_sections').doc(sectionId).delete();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// --- GESTÃO DE ITENS ---

export async function createMenuItemAction(orgId: string, data: any) {
  const db = getAdminDb();
  try {
    const itemRef = db.collection('organizations').doc(orgId).collection('menu_items').doc();
    
    // Tratamento de Timestamps para datas promocionais
    const finalData = { ...data };
    if (data.promoInicio) finalData.promoInicio = admin.firestore.Timestamp.fromDate(new Date(data.promoInicio));
    if (data.promoFim) finalData.promoFim = admin.firestore.Timestamp.fromDate(new Date(data.promoFim));

    await itemRef.set({
      ...finalData,
      id: itemRef.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, id: itemRef.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateMenuItemAction(orgId: string, itemId: string, data: any) {
  const db = getAdminDb();
  try {
    const finalData = { ...data };
    if (data.promoInicio) finalData.promoInicio = admin.firestore.Timestamp.fromDate(new Date(data.promoInicio));
    if (data.promoFim) finalData.promoFim = admin.firestore.Timestamp.fromDate(new Date(data.promoFim));

    await db.collection('organizations').doc(orgId).collection('menu_items').doc(itemId).update({
      ...finalData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteMenuItemAction(orgId: string, itemId: string) {
  const db = getAdminDb();
  try {
    await db.collection('organizations').doc(orgId).collection('menu_items').doc(itemId).delete();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
