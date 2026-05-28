'use server';

import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { headers } from 'next/headers';
import { sendPasswordResetLinkEmail } from './email';

/**
 * @fileOverview Server Actions para recuperação de senha com correção de Username vs Email.
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

    const inputClean = identifier.trim().toLowerCase();
    const isEmail = inputClean.includes("@");
    const searchField = isEmail ? "email" : "username";
    const searchValue = inputClean.replace('@', '');

    console.log(`[Recovery] Buscando por ${searchField}: ${searchValue}`);

    const userSnap = await db.collection("users")
      .where(searchField, "==", searchValue)
      .limit(1)
      .get();
    
    if (userSnap.empty) {
      return { success: false, error: 'Usuário não encontrado em nossa base.' }; 
    }

    const userData = userSnap.docs[0].data();
    const resolvedEmail = userData.email.toLowerCase().trim();
    const userName = userData.name || userData.displayName || "Usuário";

    // Verificar existência no Firebase Auth
    await auth.getUserByEmail(resolvedEmail);

    // Gerar código OTP e salvar (Validade de 60 minutos para evitar erro de fuso horário)
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); 

    await db.collection('password_reset_codes').add({
      email: resolvedEmail, // SALVAR SEMPRE O EMAIL REAL
      code,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      used: false,
      attempts: 0,
      ip,
      userAgent
    });

    const emailResult = await sendPasswordResetLinkEmail({
      to: resolvedEmail,
      userName,
      otpCode: code
    });

    if (!emailResult.success) {
      return { success: false, error: `Erro no servidor de e-mail: ${emailResult.error}` };
    }

    // Retorna o e-mail resolvido para que o frontend redirecione corretamente
    return { success: true, email: resolvedEmail };
  } catch (error: any) {
    console.error('[Recovery Error]', error);
    return { success: false, error: `Falha técnica: ${error.message}` };
  }
}

export async function verifyRecoveryCode(email: string, code: string) {
  try {
    const db = getAdminDb();
    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().toUpperCase();

    console.log(`[Verify] Validando para: ${normalizedEmail}, código digitado: ${cleanCode}`);

    // Busca apenas códigos não usados para o e-mail específico
    const snapshot = await db.collection('password_reset_codes')
      .where('email', '==', normalizedEmail)
      .where('used', '==', false)
      .get();

    if (snapshot.empty) {
      return { success: false, error: 'Nenhum código pendente para este e-mail. Solicite um novo.' };
    }
    
    const now = new Date();
    
    // Filtra em memória para evitar erro de índice composto (Failed Precondition)
    const validCodes = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((d: any) => {
        const matchesCode = d.code === cleanCode;
        const expirationDate = d.expiresAt.toDate();
        const isNotExpired = expirationDate > now;
        return matchesCode && isNotExpired;
      });

    if (validCodes.length === 0) {
      return { success: false, error: 'Código incorreto ou expirado. Tente novamente.' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('[Verify Error]', error);
    return { success: false, error: `Falha na verificação: ${error.message}` };
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

    if (snapshot.empty) throw new Error("Código expirado ou já utilizado.");

    const latestDoc = snapshot.docs[0];
    const userRecord = await auth.getUserByEmail(normalizedEmail);
    
    // Atualiza a senha no Firebase Auth
    await auth.updateUser(userRecord.uid, { password });
    
    // Marca o código como utilizado
    await latestDoc.ref.update({ 
      used: true, 
      usedAt: FieldValue.serverTimestamp() 
    });

    return { success: true };
  } catch (error: any) {
    console.error('[Reset Error]', error);
    return { success: false, error: `Erro ao redefinir: ${error.message}` };
  }
}
