
'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';

/**
 * @fileOverview Rotina de manutenção para identificar e sinalizar registros que precisam
 * de atualização para o novo padrão de CPF (Encrypted, Hash, Masked).
 */
export async function runCPFMigrationAudit() {
  const db = getAdminDb();
  
  try {
    const usersSnap = await db.collection("users").get();
    let inconsistentCount = 0;

    const batch = db.batch();

    for (const userDoc of usersSnap.docs) {
      const data = userDoc.data();
      
      // Identifica usuários que possuem o CPF no formato antigo ou mascarado sem hash
      const hasOldPattern = !data.cpfHash || !data.cpfMasked || data.cpf === "***.***.***-**";

      if (hasOldPattern) {
        batch.update(userDoc.ref, {
          cpfPatternVersion: 'legacy_masked',
          needsCPFUpdate: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        inconsistentCount++;
      }
    }

    if (inconsistentCount > 0) {
      await batch.commit();
    }

    return { success: true, count: inconsistentCount };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
