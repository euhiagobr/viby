
'use server';

import { collection, query, where, getDocs, limit, getFirestore } from 'firebase/firestore';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

/**
 * @fileOverview Server Actions para autenticação utilizando o Client SDK.
 */

async function getFirebaseComponents() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return {
    db: getFirestore(app),
    auth: getAuth(app)
  };
}

export async function requestPasswordReset(identifier: string) {
  try {
    const { db, auth } = await getFirebaseComponents();
    
    let email = identifier.trim().toLowerCase();

    if (!identifier.includes("@")) {
      const normalizedUsername = identifier.replace('@', '').toLowerCase().trim();
      const q = query(collection(db, "users"), where("username", "==", normalizedUsername), limit(1));
      const snap = await getDocs(q);
      
      if (snap.empty) throw new Error("Usuário não encontrado.");
      
      const userData = snap.docs[0].data();
      email = userData.email;
    }

    // O Client SDK envia o e-mail diretamente via Firebase Auth
    await sendPasswordResetEmail(auth, email);

    return { success: true, email };
  } catch (error: any) {
    console.error('[Auth Action Error]', error.message);
    return { success: false, error: 'Falha na solicitação de segurança.' };
  }
}
