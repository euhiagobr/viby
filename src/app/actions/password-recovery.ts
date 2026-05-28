'use server';

import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { headers } from 'next/headers';
import { sendPasswordResetLinkEmail } from './email';

/**
 * @fileOverview Recuperação de senha com proteção contra vazamento de chaves.
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
    const db = getAdminDb();
    const auth = getAdminAuth();
    
    const head = await headers();
    const ip = head.get('x-forwarded-for') || 'unknown';
    const userAgent = head.get('user-agent') || 'unknown';

    const inputClean = identifier.trim().toLowerCase();
    const isEmail = inputClean.includes("@");
    const searchField = isEmail ? "email" : "username";
    const searchValue = inputClean.replace('@', '');

    const userSnap = await db.collection("users")
      .where(searchField, "==", searchValue)
      .limit(1)
      .get();
    
    if (userSnap.empty) {
      return { success: false, error: 'Usuário não encontrado.' }; 
    }

    const userData = userSnap.docs[0].data();
    const resolvedEmail = userData.email.toLowerCase().trim();
    const userName = userData.name || userData.displayName || "Usuário";

    // Validar existência no Auth
    await auth.getUserByEmail(resolvedEmail);

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); 

    await db.collection('password_reset_codes').add({
      email: resolvedEmail,
      code,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      used: false,
      ip,
      userAgent
    });

    const emailResult = await sendPasswordResetLinkEmail({
      to: resolvedEmail,
      userName,
      otpCode: code
    });

    if (!emailResult.success) {
      return { success: false, error: 'Falha ao enviar e-mail. Tente novamente mais tarde.' };
    }

    return { success: true, email: resolvedEmail };
  } catch (error: any) {
    console.error('[Recovery Error Filtered]');
    // Impede que o erro técnico (que pode conter a chave PEM) chegue ao frontend
    return { success: false, error: 'Falha técnica no servidor de autenticação.' };
  }
}

export async function verifyRecoveryCode(email: string, code: string) {
  try {
    const db = getAdminDb();
    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().toUpperCase();

    const snapshot = await db.collection('password_reset_codes')
      .where('email', '==', normalizedEmail)
      .where('used', '==', false)
      .get();

    if (snapshot.empty) {
      return { success: false, error: 'Nenhum código pendente.' };
    }
    
    const now = new Date();
    const validCodes = snapshot.docs
      .map(d => d.data())
      .filter((d: any) => d.code === cleanCode && d.expiresAt.toDate() > now);

    if (validCodes.length === 0) {
      return { success: false, error: 'Código incorreto ou expirado.' };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'Erro ao validar código.' };
  }
}

export async function resetPasswordWithCode(email: string, code: string, password: string) {
  try {
    const db = getAdminDb();
    const auth = getAdminAuth();
    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().toUpperCase();
    
    const snapshot = await db.collection('password_reset_codes')
      .where('email', '==', normalizedEmail)
      .where('code', '==', cleanCode)
      .where('used', '==', false)
      .limit(1)
      .get();

    if (snapshot.empty) throw new Error("Código inválido.");

    const latestDoc = snapshot.docs[0];
    const userRecord = await auth.getUserByEmail(normalizedEmail);
    
    await auth.updateUser(userRecord.uid, { password });
    await latestDoc.ref.update({ used: true, usedAt: FieldValue.serverTimestamp() });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'Não foi possível redefinir sua senha.' };
  }
}
