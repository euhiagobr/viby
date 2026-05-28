'use server';

import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { sendPasswordResetLinkEmail } from './email';

/**
 * @fileOverview Server Actions para autenticação administrativa.
 */

/**
 * Solicita a redefinição de senha gerando o link oficial do Firebase.
 */
export async function requestPasswordReset(identifier: string) {
  try {
    let email = identifier.trim().toLowerCase();
    let userName = "Usuário";

    // 1. Resolver identificador (E-mail ou @Username)
    if (!identifier.includes("@")) {
      const normalizedUsername = identifier.replace('@', '').toLowerCase().trim();
      const snap = await adminDb.collection("users").where("username", "==", normalizedUsername).get();
      
      if (snap.empty) throw new Error("Usuário não encontrado.");
      
      const userData = snap.docs[0].data();
      email = userData.email;
      userName = userData.name || userData.displayName || "Usuário";
    } else {
      const snap = await adminDb.collection("users").where("email", "==", email).get();
      if (!snap.empty) {
        const userData = snap.docs[0].data();
        userName = userData.name || userData.displayName || "Usuário";
      }
    }

    // 2. Gerar link oficial de redefinição de senha
    let resetLink;
    try {
      resetLink = await adminAuth.generatePasswordResetLink(email);
    } catch (adminError: any) {
      console.error("Erro do Admin SDK ao gerar link:", adminError);
      throw new Error("Falha ao gerar link de segurança. Verifique a configuração da Service Account.");
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
