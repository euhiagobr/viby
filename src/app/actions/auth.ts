
'use server';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, setDoc, serverTimestamp, updateDoc, getDoc } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { sendPasswordResetCodeEmail } from './email';

/**
 * @fileOverview Ações de servidor para autenticação customizada (redefinição de senha).
 */

const RESET_EXPIRATION_MS = 15 * 60 * 1000; // 15 minutos

/**
 * Gera um código alfanumérico de 8 caracteres em maiúsculo.
 */
function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Solicita a redefinição de senha gerando um código e enviando por e-mail.
 */
export async function requestPasswordReset(identifier: string) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app, 'eventosviby');

    let email = identifier.trim().toLowerCase();
    let userName = "Usuário";

    // 1. Resolve o identificador (se for username, pega o email)
    if (!identifier.includes("@")) {
      const normalizedUsername = identifier.replace('@', '').toLowerCase().trim();
      const q = query(collection(db, "users"), where("username", "==", normalizedUsername));
      const snap = await getDocs(q);
      if (snap.empty) throw new Error("Usuário não encontrado.");
      const userData = snap.docs[0].data();
      email = userData.email;
      userName = userData.name || userData.displayName || "Usuário";
    } else {
      const q = query(collection(db, "users"), where("email", "==", email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const userData = snap.docs[0].data();
        userName = userData.name || userData.displayName || "Usuário";
      }
    }

    // 2. Gera o código e salva no Firestore
    const code = generateCode();
    const resetId = `${email}_reset`;
    const expiresAt = new Date(Date.now() + RESET_EXPIRATION_MS);

    await setDoc(doc(db, "password_resets", resetId), {
      email,
      code,
      expiresAt: expiresAt.toISOString(),
      used: false,
      createdAt: serverTimestamp()
    });

    // 3. Envia o e-mail
    const emailResult = await sendPasswordResetCodeEmail({
      to: email,
      userName,
      code,
      siteName: "Viby Club"
    });

    if (!emailResult.success) throw new Error("Erro ao disparar e-mail de segurança.");

    return { success: true, email };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Verifica o código e valida a intenção de troca.
 */
export async function verifyAndResetPassword(data: { email: string, code: string }) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app, 'eventosviby');

    const resetId = `${data.email}_reset`;
    const resetRef = doc(db, "password_resets", resetId);
    const resetSnap = await getDoc(resetRef);

    if (!resetSnap.exists()) throw new Error("Solicitação expirada ou inexistente.");
    
    const resetData = resetSnap.data();
    if (resetData.code !== data.code.toUpperCase()) throw new Error("Código de segurança incorreto.");
    if (new Date() > new Date(resetData.expiresAt)) throw new Error("Este código expirou (limite de 15 min).");
    if (resetData.used) throw new Error("Este código já foi utilizado.");

    // Marca como usado
    await updateDoc(resetRef, { 
      used: true, 
      updatedAt: serverTimestamp() 
    });

    // Em um ambiente real com Admin SDK, aqui trocaríamos a senha do UID associado ao e-mail.
    // No protótipo, validamos a etapa com sucesso.
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
