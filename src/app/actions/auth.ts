'use server';

import * as admin from 'firebase-admin';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { sendPasswordResetLinkEmail } from './email';

/**
 * Inicializa o Firebase Admin de forma resiliente.
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
 * Solicita a redefinição de senha gerando o link oficial do Firebase.
 */
export async function requestPasswordReset(identifier: string) {
  try {
    const app = getApps().find(a => a.name === "[DEFAULT]") || initializeApp(firebaseConfig);
    const db = getFirestore(app, 'eventosviby');
    const authAdmin = getAdminAuth();

    let email = identifier.trim().toLowerCase();
    let userName = "Usuário";

    // 1. Resolver identificador (E-mail ou @Username)
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

    // 2. Gerar link oficial de redefinição de senha
    let resetLink;
    try {
      resetLink = await authAdmin.generatePasswordResetLink(email);
    } catch (adminError: any) {
      console.error("Erro do Admin SDK ao gerar link:", adminError);
      throw new Error("O serviço de redefinição exige configuração de Service Account ou permissões administrativas.");
    }

    // 3. Disparar e-mail via SMTP
    const emailResult = await sendPasswordResetLinkEmail({
      to: email,
      userName,
      resetLink,
      siteName: "Viby"
    });

    if (!emailResult.success) {
      throw new Error("Não foi possível enviar o e-mail de segurança.");
    }

    return { success: true, email };
  } catch (error: any) {
    console.error("Erro na redefinição de senha:", error);
    return { success: false, error: error.message };
  }
}
