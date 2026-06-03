
'use server';

import { collection, query, where, getDocs, limit, getFirestore } from 'firebase/firestore';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { maskEmail } from '@/lib/crypto-utils';

/**
 * @fileOverview Recuperação de senha utilizando o fluxo nativo do Firebase Auth.
 * Substitui o fluxo de OTP customizado que exigia Admin SDK.
 */

async function getFirebaseComponents() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return {
    db: getFirestore(app),
    auth: getAuth(app)
  };
}

export async function requestPasswordRecovery(identifier: string) {
  try {
    const { db, auth } = await getFirebaseComponents();
    
    const inputClean = identifier.trim().toLowerCase();
    const isEmail = inputClean.includes("@");
    const searchField = isEmail ? "email" : "username";
    const searchValue = inputClean.replace('@', '');

    // Busca o e-mail se o usuário forneceu o username
    let targetEmail = inputClean;
    if (!isEmail) {
      const q = query(collection(db, "users"), where(searchField, "==", searchValue), limit(1));
      const userSnap = await getDocs(q);
      
      if (userSnap.empty) {
        return { success: false, error: 'Usuário não encontrado.' }; 
      }
      targetEmail = userSnap.docs[0].data().email;
    }

    // Dispara o e-mail oficial do Firebase com link de redefinição
    // O Firebase cuida da segurança, expiração e interface de troca
    await sendPasswordResetEmail(auth, targetEmail);

    return { 
      success: true, 
      maskedEmail: maskEmail(targetEmail) 
    };
  } catch (error: any) {
    console.error('[Recovery Error]', error);
    return { success: false, error: 'Falha ao processar solicitação de segurança.' };
  }
}

export async function verifyRecoveryCode(requestId: string, code: string) {
  // Depreciado: O link do Firebase agora cuida da verificação
  return { success: true };
}

export async function resetPasswordWithCode(requestId: string, code: string, password: string) {
  // Depreciado: A troca de senha ocorre na página segura do Firebase link
  return { success: false, error: 'Utilize o link enviado para seu e-mail para redefinir a senha com segurança.' };
}
