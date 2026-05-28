'use server';

import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { headers } from 'next/headers';
import { sendPasswordResetLinkEmail } from './email';

/**
 * @fileOverview Server Actions para recuperação de senha com auditoria completa.
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
    console.log({ step: 'request-recovery-start', identifier });

    let email = identifier.trim().toLowerCase();
    let userName = "Usuário";
    const head = await headers();
    const ip = head.get('x-forwarded-for') || 'unknown';
    const userAgent = head.get('user-agent') || 'unknown';

    // 1. Resolver identificador (E-mail ou @Username)
    if (!identifier.includes("@")) {
      const normalizedUsername = identifier.replace('@', '').toLowerCase().trim();
      const snap = await adminDb.collection("users").where("username", "==", normalizedUsername).limit(1).get();
      
      if (snap.empty) {
         console.warn({ step: 'request-recovery-user-not-found', username: normalizedUsername });
         return { success: true }; // Resposta genérica por segurança
      }
      
      const userData = snap.docs[0].data();
      email = userData.email;
      userName = userData.name || userData.displayName || "Usuário";
    } else {
      const snap = await adminDb.collection("users").where("email", "==", email).limit(1).get();
      if (!snap.empty) {
        const userData = snap.docs[0].data();
        userName = userData.name || userData.displayName || "Usuário";
      }
    }

    // Rate limit: 3 envios por hora
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentSends = await adminDb.collection('password_reset_codes')
      .where('email', '==', email)
      .where('createdAt', '>', oneHourAgo)
      .get();

    if (recentSends.size >= 3) {
      console.warn({ step: 'request-recovery-rate-limit', email });
      return { success: false, error: 'Muitas solicitações. Tente novamente em uma hora.' };
    }

    // Verificar se usuário existe no Auth
    let userExists = false;
    try {
      await adminAuth.getUserByEmail(email);
      userExists = true;
    } catch (e) {
       console.warn({ step: 'request-recovery-auth-not-found', email });
    }

    if (!userExists) {
      return { success: true }; // Resposta genérica
    }

    // Invalida códigos antigos
    const oldCodes = await adminDb.collection('password_reset_codes')
      .where('email', '==', email)
      .where('used', '==', false)
      .get();
    
    const batch = adminDb.batch();
    oldCodes.forEach(doc => batch.update(doc.ref, { 
      used: true, 
      invalidatedAt: FieldValue.serverTimestamp() 
    }));

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const codeRef = adminDb.collection('password_reset_codes').doc();
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
    console.log({ step: 'request-recovery-code-saved', email, codeRef: codeRef.id });

    // Enviar E-mail
    const emailResult = await sendPasswordResetLinkEmail({
      to: email,
      userName,
      otpCode: code
    });

    if (!emailResult.success) {
      throw new Error(emailResult.error || "Falha no envio do e-mail.");
    }

    return { success: true };
  } catch (error: any) {
    console.error({
      step: 'request-recovery-failure',
      error,
      message: error.message,
      stack: error.stack
    });
    return { success: false, error: 'NÃO foi possível processar sua solicitação.' };
  }
}

export async function verifyRecoveryCode(email: string, code: string) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().toUpperCase();

    console.log({ step: 'verify-code-start', email: normalizedEmail, code: cleanCode });

    const snapshot = await adminDb.collection('password_reset_codes')
      .where('email', '==', normalizedEmail)
      .where('code', '==', cleanCode)
      .where('used', '==', false)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.warn({ step: 'verify-code-not-found', email: normalizedEmail });
      return { success: false, error: 'Código inválido.' };
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    if (data.attempts >= 5) {
      console.warn({ step: 'verify-code-brute-force', email: normalizedEmail });
      return { success: false, error: 'Muitas tentativas. Solicite um novo código.' };
    }

    if (data.expiresAt.toDate() < new Date()) {
      console.warn({ step: 'verify-code-expired', email: normalizedEmail });
      return { success: false, error: 'Código expirado.' };
    }

    return { success: true, token: doc.id };
  } catch (error: any) {
    console.error({ step: 'verify-code-failure', error: error.message });
    return { success: false, error: 'Erro na validação.' };
  }
}

export async function resetPasswordWithCode(email: string, code: string, password: string) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().toUpperCase();
    
    console.log({ step: 'reset-password-start', email: normalizedEmail });

    if (password.length < 8) return { success: false, error: 'A senha deve ter no mínimo 8 caracteres.' };

    const snapshot = await adminDb.collection('password_reset_codes')
      .where('email', '==', normalizedEmail)
      .where('code', '==', cleanCode)
      .where('used', '==', false)
      .limit(1)
      .get();

    if (snapshot.empty) return { success: false, error: 'Sessão inválida.' };

    const doc = snapshot.docs[0];
    const data = doc.data();

    if (data.expiresAt.toDate() < new Date()) return { success: false, error: 'Sessão expirada.' };

    // Atualizar no Auth via Admin SDK
    const userRecord = await adminAuth.getUserByEmail(normalizedEmail);
    await adminAuth.updateUser(userRecord.uid, { password });

    // Marcar como usado
    await doc.ref.update({
      used: true,
      usedAt: FieldValue.serverTimestamp()
    });

    console.log({ step: 'reset-password-success', email: normalizedEmail, uid: userRecord.uid });

    return { success: true };
  } catch (error: any) {
    console.error({
      step: 'reset-password-failure',
      error,
      message: error.message
    });
    return { success: false, error: 'Falha ao redefinir senha.' };
  }
}
