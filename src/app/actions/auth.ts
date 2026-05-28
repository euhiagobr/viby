'use server';

import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { sendPasswordResetLinkEmail } from './email';

/**
 * @fileOverview Server Actions para autenticação com proteção de segredos.
 */

export async function requestPasswordReset(identifier: string) {
  try {
    const db = getAdminDb();
    const auth = getAdminAuth();
    
    let email = identifier.trim().toLowerCase();
    let userName = "Usuário";

    if (!identifier.includes("@")) {
      const normalizedUsername = identifier.replace('@', '').toLowerCase().trim();
      const snap = await db.collection("users").where("username", "==", normalizedUsername).limit(1).get();
      
      if (snap.empty) throw new Error("Usuário não encontrado.");
      
      const userData = snap.docs[0].data();
      email = userData.email;
      userName = userData.name || userData.displayName || "Usuário";
    }

    let resetLink = await auth.generatePasswordResetLink(email);

    const emailResult = await sendPasswordResetLinkEmail({
      to: email,
      userName,
      resetLink,
      siteName: "Viby"
    });

    if (!emailResult.success) {
      throw new Error("E-mail não pôde ser enviado.");
    }

    return { success: true, email };
  } catch (error: any) {
    console.error('[Auth Action Filtered]');
    return { success: false, error: 'Falha na solicitação de segurança.' };
  }
}
