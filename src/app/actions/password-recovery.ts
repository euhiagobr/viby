'use server';

import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { headers } from 'next/headers';
import { sendPasswordResetLinkEmail } from './email';

/**
 * @fileOverview Server Actions para recuperação de senha com tolerância de tempo aumentada.
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

    const userSnap = await db.collection("users")
      .where(searchField, "==", searchValue)
      .limit(1)
      .get();
    
    if (userSnap.empty) {
      return { success: false, error: 'Usuário não encontrado.' }; 
    }

    const userData = userSnap.docs[0].data();
    const email = userData.email.toLowerCase().trim();
    const userName = userData.name || userData.displayName || "Usuário";

    // Verificar se o usuário existe no Auth
    await auth.getUserByEmail(email);

    // Gerar código OTP e salvar (Validade de 60 minutos para evitar dessincronia)
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); 

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

    const emailResult = await sendPasswordResetLinkEmail({
      to: email,
      userName,
      otpCode: code
    });

    if (!emailResult.success) {
      return { success: false, error: `Erro no SMTP: ${emailResult.error}` };
    }

    return { success: true };
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

    // Consulta básica sem depender de índices compostos
    const snapshot = await db.collection('password_reset_codes')
      .where('email', '==', normalizedEmail)
      .where('used', '==', false)
      .get();

    if (snapshot.empty) {
      return { success: false, error: 'Nenhum código pendente para este e-mail.' };
    }
    
    const now = new Date();
    
    // Filtragem em memória com logs de depuração
    const validCodes = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((d: any) => {
        const matchesCode = d.code === cleanCode;
        const expirationDate = d.expiresAt.toDate();
        const isNotExpired = expirationDate > now;
        
        console.log(`[Verify] Analisando: CodeMatch=${matchesCode}, Expira=${expirationDate.toISOString()}, Agora=${now.toISOString()}, Válido=${isNotExpired}`);
        
        return matchesCode && isNotExpired;
      });

    if (validCodes.length === 0) {
      return { success: false, error: 'Código incorreto ou expirado.' };
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
      .get();

    if (snapshot.empty) throw new Error("Validação expirada. Solicite novo código.");

    const latestDoc = snapshot.docs[0];
    const userRecord = await auth.getUserByEmail(normalizedEmail);
    await auth.updateUser(userRecord.uid, { password });
    
    await latestDoc.ref.update({ 
      used: true, 
      usedAt: FieldValue.serverTimestamp() 
    });

    return { success: true };
  } catch (error: any) {
    console.error('[Reset Error]', error);
    return { success: false, error: `Erro na troca de senha: ${error.message}` };
  }
}
