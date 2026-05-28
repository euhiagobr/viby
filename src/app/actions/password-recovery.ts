'use server';

import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { headers } from 'next/headers';
import { sendPasswordResetLinkEmail } from './email';

/**
 * @fileOverview Server Actions para recuperação de senha com normalização e logs.
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
    
    const head = await headers();
    const ip = head.get('x-forwarded-for') || 'unknown';
    const userAgent = head.get('user-agent') || 'unknown';

    // 1. Resolver identificador (E-mail ou @Username)
    const isEmail = identifier.includes("@");
    const searchField = isEmail ? "email" : "username";
    const searchValue = identifier.replace('@', '').toLowerCase().trim();

    const userSnap = await db.collection("users")
      .where(searchField, "==", searchValue)
      .limit(1)
      .get();
    
    if (userSnap.empty) {
      console.warn(`[Recovery] Identificador não localizado: ${searchValue}`);
      return { success: false, error: 'Usuário não encontrado em nossa base.' }; 
    }

    const userData = userSnap.docs[0].data();
    const email = userData.email.toLowerCase().trim();
    const userName = userData.name || userData.displayName || "Usuário";

    // 2. Verificar se o usuário existe no Firebase Auth
    try {
      await auth.getUserByEmail(email);
    } catch (e: any) {
       console.error(`[Recovery] Usuário existe no Firestore mas não no Auth: ${email}`);
       return { success: false, error: 'Falha na integridade da conta. Contate o suporte.' };
    }

    // 3. Gerar código OTP e salvar
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); 

    await db.collection('password_reset_codes').add({
      email,
      code,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      used: false,
      attempts: 0,
      ip,
      userAgent
    });

    console.log(`[Recovery] Código gerado para ${email}: ${code}`);

    // 4. Enviar E-mail via SMTP
    const emailResult = await sendPasswordResetLinkEmail({
      to: email,
      userName,
      otpCode: code
    });

    if (!emailResult.success) {
      throw new Error(`Erro SMTP: ${emailResult.error}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error('[Recovery Error]', error);
    return { success: false, error: `Erro no processamento: ${error.message}` };
  }
}

export async function verifyRecoveryCode(email: string, code: string) {
  try {
    const db = getAdminDb();
    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().toUpperCase();

    console.log(`[Verify] Validando código para ${normalizedEmail}: ${cleanCode}`);

    const snapshot = await db.collection('password_reset_codes')
      .where('email', '==', normalizedEmail)
      .where('code', '==', cleanCode)
      .where('used', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.warn(`[Verify] Código ${cleanCode} não encontrado ou já usado para ${normalizedEmail}`);
      return { success: false, error: 'Código inválido ou já utilizado.' };
    }
    
    const data = snapshot.docs[0].data();
    const expiration = data.expiresAt.toDate();
    
    if (expiration < new Date()) {
      console.warn(`[Verify] Código ${cleanCode} expirou em ${expiration}`);
      return { success: false, error: 'Este código expirou. Solicite um novo.' };
    }

    console.log(`[Verify] Código validado com sucesso para ${normalizedEmail}`);
    return { success: true };
  } catch (error: any) {
    console.error('[Verify Error]', error);
    return { success: false, error: `Falha técnica: ${error.message}` };
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

    if (snapshot.empty) throw new Error("Código inválido ou expirado.");

    const userRecord = await auth.getUserByEmail(normalizedEmail);
    await auth.updateUser(userRecord.uid, { password });
    
    await snapshot.docs[0].ref.update({ 
      used: true, 
      usedAt: FieldValue.serverTimestamp() 
    });

    console.log(`[Reset] Senha atualizada com sucesso para ${normalizedEmail}`);
    return { success: true };
  } catch (error: any) {
    console.error('[Reset Error]', error);
    return { success: false, error: `Não foi possível trocar a senha: ${error.message}` };
  }
}
