'use server';

import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { headers } from 'next/headers';
import { sendPasswordResetLinkEmail } from './email';

/**
 * @fileOverview Server Actions para recuperação de senha com auditoria via Firebase Admin.
 */

const GENERATOR_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateOTP(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += GENERATOR_CHARS.charAt(Math.floor(Math.random() * GENERATOR_CHARS.length));
  }
  return code;
}

export async function requestPasswordRecovery(identifier: string) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();
    
    let email = identifier.trim().toLowerCase();
    let userName = "Usuário";
    const head = await headers();
    const ip = head.get('x-forwarded-for') || 'unknown';
    const userAgent = head.get('user-agent') || 'unknown';

    // 1. Resolver identificador
    if (!identifier.includes("@")) {
      const normalizedUsername = identifier.replace('@', '').toLowerCase().trim();
      const snap = await db.collection("users").where("username", "==", normalizedUsername).limit(1).get();
      
      if (snap.empty) {
         console.warn(`[Recovery] Usuário não encontrado para username: ${normalizedUsername}`);
         return { success: true }; // Resposta genérica por segurança
      }
      
      const userData = snap.docs[0].data();
      email = userData.email;
      userName = userData.name || userData.displayName || "Usuário";
    } else {
      const snap = await db.collection("users").where("email", "==", email).limit(1).get();
      if (!snap.empty) {
        const userData = snap.docs[0].data();
        userName = userData.name || userData.displayName || "Usuário";
      }
    }

    // 2. Verificar existência no Firebase Auth
    try {
      await auth.getUserByEmail(email);
    } catch (e) {
       console.warn(`[Recovery] Email não cadastrado no Auth: ${email}`);
       return { success: true }; // Resposta genérica
    }

    // 3. Invalida códigos antigos
    const oldCodes = await db.collection('password_reset_codes')
      .where('email', '==', email)
      .where('used', '==', false)
      .get();
    
    const batch = db.batch();
    oldCodes.forEach(doc => batch.update(doc.ref, { 
      used: true, 
      invalidatedAt: FieldValue.serverTimestamp() 
    }));

    // 4. Gerar novo código
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const codeRef = db.collection('password_reset_codes').doc();
    batch.set(codeRef, {
      email,
      code,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      used: false,
      attempts: 0,
      ip,
      userAgent
    });

    await batch.commit();

    // 5. Enviar E-mail
    const emailResult = await sendPasswordResetLinkEmail({
      to: email,
      userName,
      otpCode: code
    });

    if (!emailResult.success) {
      throw new Error(emailResult.error || "Falha no disparo do SMTP.");
    }

    console.log(`[Recovery] Sucesso para ${email}. Código: ${code}`);
    return { success: true };
  } catch (error: any) {
    console.error('[Recovery Error]', {
      message: error.message,
      stack: error.stack
    });
    return { success: false, error: 'Ocorreu um erro ao processar sua solicitação.' };
  }
}

export async function verifyRecoveryCode(email: string, code: string) {
  try {
    const db = getAdminDb();
    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().toUpperCase();

    const snapshot = await db.collection('password_reset_codes')
      .where('email', '==', normalizedEmail)
      .where('code', '==', cleanCode)
      .where('used', '==', false)
      .limit(1)
      .get();

    if (snapshot.empty) return { success: false, error: 'Código inválido.' };

    const doc = snapshot.docs[0];
    const data = doc.data();

    if (data.expiresAt.toDate() < new Date()) return { success: false, error: 'Código expirado.' };

    return { success: true };
  } catch (error: any) {
    console.error('[Verify Code Error]', error.message);
    return { success: false, error: 'Erro na validação.' };
  }
}

export async function resetPasswordWithCode(email: string, code: string, password: string) {
  try {
    const db = getAdminDb();
    const auth = getAdminAuth();
    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().toUpperCase();
    
    if (password.length < 8) return { success: false, error: 'A senha deve ter no mínimo 8 caracteres.' };

    const snapshot = await db.collection('password_reset_codes')
      .where('email', '==', normalizedEmail)
      .where('code', '==', cleanCode)
      .where('used', '==', false)
      .limit(1)
      .get();

    if (snapshot.empty) return { success: false, error: 'Sessão inválida.' };

    const doc = snapshot.docs[0];
    const userRecord = await auth.getUserByEmail(normalizedEmail);
    await auth.updateUser(userRecord.uid, { password });

    await doc.ref.update({
      used: true,
      usedAt: FieldValue.serverTimestamp()
    });

    console.log(`[Reset Password] Sucesso para UID ${userRecord.uid}`);
    return { success: true };
  } catch (error: any) {
    console.error('[Reset Password Error]', error.message);
    return { success: false, error: 'Falha ao redefinir senha.' };
  }
}
