'use server';

import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { headers } from 'next/headers';
import { sendPasswordResetLinkEmail } from './email';

/**
 * @fileOverview Server Actions para recuperação de senha.
 * Adicionado logs de erro detalhados para diagnosticar falhas de credenciais ou SMTP.
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
    console.log(`[Recovery] Iniciando solicitação para: ${identifier}`);
    
    const auth = getAdminAuth();
    const db = getAdminDb();
    
    let email = identifier.trim().toLowerCase();
    let userName = "Usuário";
    const head = await headers();
    const ip = head.get('x-forwarded-for') || 'unknown';
    const userAgent = head.get('user-agent') || 'unknown';

    // 1. Resolver identificador
    const isEmail = identifier.includes("@");
    const userSnap = await db.collection("users")
      .where(isEmail ? "email" : "username", "==", identifier.replace('@', '').toLowerCase().trim())
      .limit(1)
      .get();
    
    if (userSnap.empty) {
      console.warn(`[Recovery] Usuário não encontrado no Firestore: ${identifier}`);
      // Por segurança, retornamos sucesso mesmo que não exista, para evitar enumeração de emails
      return { success: true }; 
    }

    const userData = userSnap.docs[0].data();
    email = userData.email;
    userName = userData.name || userData.displayName || "Usuário";

    // 2. Verificar no Auth para garantir que o usuário existe no provedor de senha
    try {
      await auth.getUserByEmail(email);
    } catch (e: any) {
       console.error('[Recovery Auth Error] Usuário existe no Firestore mas não no Firebase Auth:', e.code);
       return { success: false, error: 'Conta não configurada corretamente para login com senha.' };
    }

    // 3. Gerar código e salvar no Firestore
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

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

    console.log(`[Recovery] Código OTP gerado para ${email}`);

    // 4. Enviar E-mail via SMTP
    const emailResult = await sendPasswordResetLinkEmail({
      to: email,
      userName,
      otpCode: code
    });

    if (!emailResult.success) {
      console.error('[Recovery SMTP Error]', emailResult.error);
      throw new Error(emailResult.error || "Falha ao enviar e-mail.");
    }

    console.log(`[Recovery] E-mail enviado com sucesso para ${email}`);
    return { success: true };
  } catch (error: any) {
    console.error('[Recovery Global Failure]', {
      message: error.message,
      stack: error.stack
    });
    // Retornamos o erro específico durante o desenvolvimento para ajudar o usuário
    return { success: false, error: error.message || 'Falha interna ao processar solicitação.' };
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
    console.error('[Verify Code Error]', error.message);
    return { success: false, error: 'Erro na validação do código.' };
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

    console.log(`[Reset Password] Senha atualizada com sucesso para: ${email}`);
    return { success: true };
  } catch (error: any) {
    console.error('[Reset Password Error]', error.message);
    return { success: false, error: 'Falha ao redefinir a senha.' };
  }
}
