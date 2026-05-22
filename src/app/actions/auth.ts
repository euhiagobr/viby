'use server';

import * as admin from 'firebase-admin';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { authConfig, vibyConfig } from '@/firebase/config';
import { sendPasswordResetLinkEmail } from './email';

/**
 * Inicializa o Firebase Admin de forma resiliente.
 * Em ambientes como o Firebase Studio, tentamos usar o Application Default Credentials (ADC).
 */
function getAdminAuth() {
  if (admin.apps.length === 0) {
    try {
      // Inicialização sem o parâmetro 'credential' para tentar herdar do ambiente
      // ou apenas passando o projectId.
      admin.initializeApp({
        projectId: authConfig.projectId,
      });
    } catch (e) {
      console.error("Erro ao inicializar Firebase Admin:", e);
    }
  }
  return admin.auth();
}

/**
 * Solicita a redefinição de senha gerando o link oficial do Firebase.
 * O link é enviado através do sistema de e-mail customizado da Viby.
 */
export async function requestPasswordReset(identifier: string) {
  try {
    // Inicialização das apps cliente para busca de dados
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
      // Busca dados do usuário pelo e-mail para pegar o nome
      const q = query(collection(db, "users"), where("email", "==", email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const userData = snap.docs[0].data();
        userName = userData.name || userData.displayName || "Usuário";
      }
    }

    // 2. Gerar link oficial de redefinição de senha
    // Este link aponta para o domínio de auth do Firebase onde a troca é efetivada
    const resetLink = await authAdmin.generatePasswordResetLink(email);

    // 3. Disparar e-mail via SMTP customizado contendo o link oficial
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
    
    // Tratamento de erro de credenciais específico para o usuário
    if (error.message?.includes("credential") || error.code === 'auth/operation-not-allowed') {
      return { 
        success: false, 
        error: "O serviço de geração de links está temporariamente indisponível. Verifique as permissões do Firebase Admin." 
      };
    }

    return { success: false, error: error.message };
  }
}
