'use server';

import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  getFirestore, 
  serverTimestamp, 
  doc, 
  Timestamp, 
  getDoc as firestoreGetDoc,
  writeBatch,
  updateDoc
} from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { maskEmail } from '@/lib/crypto-utils';
import { sendOTPRecoveryEmail, sendPasswordChangedNotificationEmail } from './email';
import { getAdminAuth } from '@/lib/firebase/admin';
import { headers } from 'next/headers';

/**
 * @fileOverview Ações de Recuperação de Senha via OTP (6 dígitos).
 * Fluxo auditado: 1 código ativo por vez, validade de 10 min, rate limit robusto.
 */

async function getDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

/**
 * Fase 1: Solicitar recuperação.
 */
export async function requestPasswordRecovery(identifier: string) {
  const auditId = Math.random().toString(36).substring(7).toUpperCase();
  console.log(`[Recovery-${auditId}] Início da solicitação para: ${identifier}`);

  try {
    const db = await getDb();
    const inputClean = identifier.trim().toLowerCase();
    const isEmail = inputClean.includes("@");
    
    let userId = "";
    let targetEmail = "";
    let userName = "";

    // 1. LOCALIZAÇÃO DO USUÁRIO
    if (isEmail) {
      const q = query(collection(db, "users"), where("email", "==", inputClean), limit(1));
      const userSnap = await getDocs(q);
      if (!userSnap.empty) {
        const u = userSnap.docs[0];
        userId = u.id;
        targetEmail = u.data().email;
        userName = u.data().name || u.data().displayName || "Usuário";
      }
    } else {
      const cleanUser = inputClean.replace('@', '');
      const usernameRef = doc(db, "usernames", cleanUser);
      const usernameSnap = await firestoreGetDoc(usernameRef);
      
      if (usernameSnap.exists()) {
        const indexData = usernameSnap.data();
        if (indexData.type === 'user') {
          userId = indexData.uid;
          const userSnap = await firestoreGetDoc(doc(db, "users", userId));
          if (userSnap.exists()) {
            const uData = userSnap.data();
            targetEmail = uData.email;
            userName = uData.name || uData.displayName || "Usuário";
          }
        }
      }
    }

    if (!userId || !targetEmail) {
      return { success: true, maskedEmail: "seu e-mail cadastrado" };
    }

    // 2. RATE LIMIT (3 códigos a cada 20 min)
    const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000);
    const rateQ = query(
      collection(db, "password_reset_codes"), 
      where("userId", "==", userId),
      where("used", "==", false),
      limit(10)
    );
    const rateSnap = await getDocs(rateQ);
    const recentRequests = rateSnap.docs.filter(d => {
      const createdAt = d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(0);
      return createdAt > twentyMinAgo;
    });

    if (recentRequests.length >= 3) {
      return { success: false, error: "Muitas solicitações. Tente novamente em 20 minutos." };
    }

    // 3. INVALIDAÇÃO E GERAÇÃO
    const batch = writeBatch(db);
    const allPendingSnap = await getDocs(query(collection(db, "password_reset_codes"), where("userId", "==", userId), where("used", "==", false)));
    allPendingSnap.forEach(d => {
      batch.update(d.ref, { used: true, usedAt: serverTimestamp(), invalidationReason: 'superseded' });
    });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const resetRef = doc(collection(db, "password_reset_codes"));

    batch.set(resetRef, {
      email: targetEmail,
      userId: userId,
      code: otpCode,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      used: false,
      attempts: 0
    });

    await batch.commit();
    
    await sendOTPRecoveryEmail({
      to: targetEmail,
      userName: userName,
      otpCode: otpCode
    });

    return { 
      success: true, 
      requestId: resetRef.id,
      maskedEmail: maskEmail(targetEmail) 
    };

  } catch (error: any) {
    return { success: false, error: 'Erro ao processar solicitação.' };
  }
}

/**
 * Fase 2: Validar o código.
 */
export async function verifyRecoveryCode(requestId: string, code: string) {
  try {
    const db = await getDb();
    const resetRef = doc(db, "password_reset_codes", requestId);
    const resetSnap = await firestoreGetDoc(resetRef);

    if (!resetSnap.exists()) return { success: false, error: "Solicitação inválida." };

    const data = resetSnap.data();
    const now = new Date();
    const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);

    if (data.used || now > expiresAt) return { success: false, error: "Código expirado ou já utilizado." };
    if ((data.attempts || 0) >= 10) return { success: false, error: "Muitas tentativas." };

    if (data.code !== code) {
      await updateDoc(resetRef, { attempts: (data.attempts || 0) + 1 });
      return { success: false, error: "Código incorreto." };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: "Falha técnica na validação." };
  }
}

/**
 * Fase 3: Trocar a senha e notificar.
 */
export async function resetPasswordWithCode(requestId: string, code: string, password: string) {
  try {
    const db = await getDb();
    const resetRef = doc(db, "password_reset_codes", requestId);
    const resetSnap = await firestoreGetDoc(resetRef);

    if (!resetSnap.exists()) throw new Error("Sessão expirada.");
    const resetData = resetSnap.data();
    const now = new Date();
    const expiresAt = resetData.expiresAt?.toDate ? resetData.expiresAt.toDate() : new Date(resetData.expiresAt);

    if (resetData.code !== code || resetData.used || now > expiresAt) {
      return { success: false, error: "Código inválido ou expirado." };
    }

    const userId = resetData.userId;
    const targetEmail = resetData.email;
    const adminAuth = getAdminAuth();
    
    // 1. Atualizar no Firebase Auth
    await adminAuth.updateUser(userId, { password });

    // 2. Invalidar todos os códigos
    const batch = writeBatch(db);
    const allCodesSnap = await getDocs(query(collection(db, "password_reset_codes"), where("userId", "==", userId), where("used", "==", false)));
    allCodesSnap.forEach(d => {
      batch.update(d.ref, { 
        used: true, 
        usedAt: serverTimestamp(),
        invalidationReason: d.id === requestId ? 'used_for_reset' : 'cleared_after_success'
      });
    });
    await batch.commit();

    // 3. Notificação de Segurança com Metadados
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0] || headersList.get('x-real-ip') || 'IP não identificado';
    const city = headersList.get('x-vercel-ip-city') || headersList.get('x-apphosting-city') || 'Localização não identificada';
    const country = headersList.get('x-vercel-ip-country') || 'Brasil';
    const location = city !== 'Localização não identificada' ? `${city}, ${country}` : country;
    
    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const userSnap = await firestoreGetDoc(doc(db, "users", userId));
    const userName = userSnap.exists() ? (userSnap.data().name || userSnap.data().displayName || "Usuário") : "Usuário";

    // Disparo assíncrono da notificação
    sendPasswordChangedNotificationEmail({
      to: targetEmail,
      userName,
      ip,
      location,
      timestamp
    }).catch(e => console.warn("[Security Email] Failed to send notification", e));

    return { success: true };
  } catch (error: any) {
    console.error("[Reset Error]", error.message);
    return { success: false, error: "Falha técnica ao atualizar senha." };
  }
}
