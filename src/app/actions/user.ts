
'use server';

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { decryptData, encryptDeterministic } from '@/lib/crypto-utils';

/**
 * @fileOverview Server Actions para manipulação de dados sensíveis de usuários.
 * Garante que a descriptografia e o acesso a campos protegidos ocorram no servidor.
 */

async function getDb() {
  const app = getApps().find(a => a.name === "[DEFAULT]") || initializeApp(firebaseConfig);
  return getFirestore(app, 'eventosviby');
}

/**
 * Recupera o CPF descriptografado de um usuário (apenas para o próprio usuário ou admin).
 */
export async function getUserCPF(userId: string, requestingUid: string) {
  try {
    const db = await getDb();
    
    // Verificação de permissão no servidor
    if (requestingUid !== userId) {
      const requesterSnap = await getDoc(doc(db, "users", requestingUid));
      if (!requesterSnap.exists() || requesterSnap.data().role !== 'admin') {
        throw new Error("Acesso negado.");
      }
    }

    const sensitiveRef = doc(db, "users", userId, "private", "sensitive");
    const snap = await getDoc(sensitiveRef);
    
    if (snap.exists()) {
      const encryptedCpf = snap.data().cpf;
      return { success: true, cpf: decryptData(encryptedCpf) };
    }
    
    return { success: false, error: "Dados não encontrados." };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Salva ou atualiza o CPF criptografado na subcoleção privada.
 */
export async function updateUserCPF(userId: string, cpf: string) {
  try {
    const db = await getDb();
    const encryptedCpf = encryptDeterministic(cpf);
    const sensitiveRef = doc(db, "users", userId, "private", "sensitive");
    
    await setDoc(sensitiveRef, {
      cpf: encryptedCpf,
      updatedAt: serverTimestamp()
    }, { merge: true });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
