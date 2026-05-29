'use server';

import { db } from '@/firebase/database';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  addDoc, 
  doc, 
  getDoc, 
  updateDoc, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { headers } from 'next/headers';
import { sendPasswordResetLinkEmail } from './email';
import { maskEmail } from '@/lib/crypto-utils';

/**
 * @fileOverview Recuperação de senha baseada em OTP armazenado no Firestore.
 * Refatorado para Server Action para permitir uso de headers() e segurança.
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
    const head = await headers();
    const ip = head.get('x-forwarded-for') || 'unknown';
    const userAgent = head.get('user-agent') || 'unknown';

    const inputClean = identifier.trim().toLowerCase();
    const isEmail = inputClean.includes("@");
    const searchField = isEmail ? "email" : "username";
    const searchValue = inputClean.replace('@', '');

    const q = query(collection(db, "users"), where(searchField, "==", searchValue), limit(1));
    const userSnap = await getDocs(q);
    
    if (userSnap.empty) {
      return { success: false, error: 'Usuário não encontrado.' }; 
    }

    const userData = userSnap.docs[0].data();
    const resolvedEmail = userData.email.toLowerCase().trim();
    const userName = userData.name || userData.displayName || "Usuário";

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 minutos

    const docRef = await addDoc(collection(db, 'password_reset_codes'), {
      email: resolvedEmail,
      code,
      createdAt: serverTimestamp(),
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

    return { 
      success: true, 
      requestId: docRef.id,
      maskedEmail: maskEmail(resolvedEmail) 
    };
  } catch (error: any) {
    console.error('[Recovery Error Filtered]', error);
    return { success: false, error: 'Falha técnica no servidor de autenticação.' };
  }
}

export async function verifyRecoveryCode(requestId: string, code: string) {
  try {
    const cleanCode = code.trim().toUpperCase();
    const docRef = doc(db, 'password_reset_codes', requestId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return { success: false, error: 'Solicitação não encontrada.' };
    }
    
    const data = snap.data();
    const now = new Date();

    if (data?.used) return { success: false, error: 'Este código já foi utilizado.' };
    if (data?.code !== cleanCode) return { success: false, error: 'Código incorreto.' };
    
    const expires = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
    if (expires < now) return { success: false, error: 'Código expirado.' };

    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'Erro ao validar código.' };
  }
}

export async function resetPasswordWithCode(requestId: string, code: string, password: string) {
  try {
    // Nota: O Firebase Client SDK não permite trocar a senha de outro usuário no servidor
    // sem o Admin SDK. Como estamos em uma Server Action, o ideal seria implementar via Admin SDK aqui.
    return { success: false, error: 'Funcionalidade requerida: Admin SDK configurado.' };
  } catch (error: any) {
    return { success: false, error: 'Não foi possível redefinir sua senha.' };
  }
}