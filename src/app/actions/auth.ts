'use server';

import * as admin from 'firebase-admin';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { sendPasswordResetLinkEmail } from './email';

/**
 * Inicializa o Firebase Admin SDK de forma resiliente usando o ID do novo projeto.
 */
function getAdminAuth() {
  if (admin.apps.length === 0) {
    try {
      admin.initializeApp({
        projectId: firebaseConfig.projectId,
      });
    } catch (e) {
      console.error("Erro ao inicializar Firebase Admin:", e);
    }
  }
  return admin.auth();
}

/**
 * Solicita a redefinição de senha gerando um link oficial e enviando por e-mail próprio.
 */
export async function requestPasswordReset(identifier: string) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app, 'eventosviby');
    const authAdmin = getAdminAuth();

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

    // 2. Gera o LINK oficial do Firebase
    const resetLink = await authAdmin.generatePasswordResetLink(email);

    // 3. Envia o e-mail via SMTP configurado
    const emailResult = await sendPasswordResetLinkEmail({
      to: email,
      userName,
      resetLink,
      siteName: "Viby"
    });

    if (!emailResult.success) throw new Error("Erro ao disparar e-mail de segurança.");

    return { success: true, email };
  } catch (error: any) {
    console.error("Erro na redefinição de senha:", error);
    return { success: false, error: error.message };
  }
}
