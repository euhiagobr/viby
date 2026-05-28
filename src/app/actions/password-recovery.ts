'use server';

import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { headers } from 'next/headers';
import { sendPasswordResetLinkEmail } from './email';

/**
 * @fileOverview Server Actions para recuperação de senha com debug estendido.
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

    // 1. Resolver identificador (E-mail ou @Username)
    const isEmail = identifier.includes("@");
    const userSnap = await db.collection("users")
      .where(isEmail ? "email" : "username", "==", identifier.replace('@', '').toLowerCase().trim())
      .limit(1)
      .get();
    
    if (userSnap.empty) {
      return { success: false, error: `Identificador não localizado: ${identifier}` }; 
    }

    const userData = userSnap.docs[0].data();
    email = userData.email;
    userName = userData.name || userData.displayName || "Usuário";

    // 2. Verificar se o usuário existe no Firebase Auth
    try {
      await auth.getUserByEmail(email);
    } catch (e: any) {
       return { success: false, error: `Autenticação falhou: Usuário ${email} não existe no Firebase Auth.` };
    }

    // 3. Gerar código OTP e salvar
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); 

    const codeRef = db.collection('password_reset_codes').doc();
    await codeRef.set({
      email,
      code,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      used: false,
      attempts: 0,
      ip,
      userAgent
    });

    // 4. Enviar E-mail via SMTP
    const emailResult = await sendPasswordResetLinkEmail({
      to: email,
      userName,
      otpCode: code
    });

    if (!emailResult.success) {
      throw new Error(`Falha no SMTP: ${emailResult.error}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error('[Recovery Failure Log]', error);
    return { 
      success: false, 
      error: `ERRO TÉCNICO: ${error.message}${error.code ? ` (Code: ${error.code})` : ''}` 
    };
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
    
    const data = snapshot.docs[0].data();
    if (data.expiresAt.toDate() < new Date()) return { success: false, error: 'Código expirado.' };

    return { success: true };
  } catch (error: any) {
    return { success: false, error: `Falha na validação: ${error.message}` };
  }
}

export async function resetPasswordWithCode(email: string, code: string, password: string) {
  try {
    const db = getAdminDb();
    const auth = getAdminAuth();
    
    const snapshot = await db.collection('password_reset_codes')
      .where('email', '==', email.toLowerCase())
      .where('code', '==', code.toUpperCase())
      .where('used', '==', false)
      .limit(1)
      .get();

    if (snapshot.empty) throw new Error("Código expirado ou já utilizado.");

    const userRecord = await auth.getUserByEmail(email);
    await auth.updateUser(userRecord.uid, { password });
    
    await snapshot.docs[0].ref.update({ 
      used: true, 
      usedAt: FieldValue.serverTimestamp() 
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: `Falha na redefinição: ${error.message}` };
  }
}
