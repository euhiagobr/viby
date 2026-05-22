'use server';

import * as admin from 'firebase-admin';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { authConfig, vibyConfig } from '@/firebase/config';
import { sendPasswordResetLinkEmail } from './email';

/**
 * Inicializa o Firebase Admin de forma resiliente para o projeto de Auth.
 */
function getAdminAuth() {
  const adminApp = admin.apps.find(a => a?.name === '[DEFAULT]' || a?.options?.projectId === authConfig.projectId);
  
  if (!adminApp) {
    try {
      admin.initializeApp({
        projectId: authConfig.projectId,
      });
    } catch (e) {
      // Falha silenciosa se já existir
    }
  }
  return admin.auth();
}

/**
 * Solicita a redefinição de senha gerando o link oficial do Firebase.
 */
export async function requestPasswordReset(identifier: string) {
  try {
    // Inicialização da app cliente Viby para busca de dados no Firestore do projeto ONG
    const vibyApp = getApps().find(a => a.name === "vibyApp") || initializeApp(vibyConfig, "vibyApp");
    const db = getFirestore(vibyApp, 'eventosviby');
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
    // Nota: generatePasswordResetLink exige que o projeto 'authConfig.projectId' tenha uma Service Account ativa
    const resetLink = await authAdmin.generatePasswordResetLink(email);

    // 3. Disparar e-mail via SMTP customizado
    const emailResult = await sendPasswordResetLinkEmail({
      to: email,
      userName,
      resetLink,
      siteName: "Viby"
    });

    if (!emailResult.success) {
      throw new Error("Não foi possível enviar o e-mail de segurança. Verifique as configurações de SMTP.");
    }

    return { success: true, email };
  } catch (error: any) {
    console.error("Erro na redefinição de senha:", error);
    
    let userFriendlyError = error.message;
    
    // Tratamento de erro de credenciais específico
    if (error.message?.includes("credential") || error.code?.includes("auth/operation-not-allowed") || error.message?.includes("access token")) {
      userFriendlyError = "O serviço de geração de links exige configuração de Service Account no projeto de Auth. Por favor, verifique o console do Firebase.";
    }

    return { success: false, error: userFriendlyError };
  }
}
