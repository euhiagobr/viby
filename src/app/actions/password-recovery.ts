
'use server';

import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { headers } from 'next/headers';
import { sendPasswordResetLinkEmail } from './email';
import { maskEmail } from '@/lib/crypto-utils';

/**
 * @fileOverview Recuperação de senha com proteção contra vazamento de chaves e privacidade de e-mail.
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
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 minutos

    const docRef = await db.collection('password_reset_codes').add({
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

    // Retorna o ID da solicitação e o e-mail mascarado para o cliente
    return { 
      success: true, 
      requestId: docRef.id,
      maskedEmail: maskEmail(resolvedEmail) 
    };
  } catch (error: any) {
    console.error('[Recovery Error Filtered]');
    return { success: false, error: 'Falha técnica no servidor de autenticação.' };
  }
}

export async function verifyRecoveryCode(requestId: string, code: string) {
  try {
    const db = getAdminDb();
    const cleanCode = code.trim().toUpperCase();

    const docRef = db.collection('password_reset_codes').doc(requestId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { success: false, error: 'Solicitação não encontrada.' };
    }
    
    const data = snap.data();
    const now = new Date();

    if (data?.used) return { success: false, error: 'Este código já foi utilizado.' };
    if (data?.code !== cleanCode) return { success: false, error: 'Código incorreto.' };
    if (data?.expiresAt.toDate() < now) return { success: false, error: 'Código expirado.' };

    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'Erro ao validar código.' };
  }
}

export async function resetPasswordWithCode(requestId: string, code: string, password: string) {
  try {
    const db = getAdminDb();
    const auth = getAdminAuth();
    const cleanCode = code.trim().toUpperCase();
    
    const docRef = db.collection('password_reset_codes').doc(requestId);
    const snap = await docRef.get();

    if (!snap.exists) throw new Error("Solicitação inválida.");

    const data = snap.data();
    if (data?.used || data?.code !== cleanCode) throw new Error("Validação falhou.");

    const userRecord = await auth.getUserByEmail(data.email);
    
    await auth.updateUser(userRecord.uid, { password });
    await docRef.update({ used: true, usedAt: FieldValue.serverTimestamp() });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'Não foi possível redefinir sua senha.' };
  }
}
