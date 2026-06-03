'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';

/**
 * @fileOverview Server Action para persistência de logs de erro via Admin SDK.
 * Chamada pelo logSystemError quando executado no cliente.
 */
export async function saveSystemErrorAction(logData: any) {
  try {
    const db = getAdminDb();
    await db.collection('system_logs').add({
      ...logData,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (e) {
    console.error("[Error Action] Failed to save log:", e);
    return { success: false };
  }
}
