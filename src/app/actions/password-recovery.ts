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
  writeBatch
} from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { maskEmail } from '@/lib/crypto-utils';
import { sendOTPRecoveryEmail } from './email';
import { getAdminAuth } from '@/lib/firebase/admin';

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
 * Localiza o usuário e dispara o código por e-mail.
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

    // RESPOSTA SEGURA: Se não existir, retornamos sucesso mas não fazemos nada.
    if (!userId || !targetEmail) {
      console.log(`[Recovery-${auditId}] Usuário não localizado. Retornando resposta genérica por segurança.`);
      return { success: true, maskedEmail: "seu e-mail cadastrado" };
    }

    // 2. RATE LIMIT (3 códigos ativos/recentes a cada 20 minutos por usuário)
    const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000);
    const rateQ = query(
      collection(db, "password_reset_codes"), 
      where("userId", "==", userId),
      where("used", "==", false),
      limit(10)
    );
    const rateSnap = await getDocs(rateQ);
    const recentRequests = rateSnap.docs.filter(d => {
      const dData = d.data();
      const createdAt = dData.createdAt?.toDate ? dData.createdAt.toDate() : new Date(0);
      return createdAt > twentyMinAgo;
    });

    if (recentRequests.length >= 3) {
      console.warn(`[Recovery-${auditId}] Rate limit atingido para UID: ${userId}`);
      return { success: false, error: "Muitas solicitações. Tente novamente em 20 minutos." };
    }

    // 3. INVALIDAÇÃO DE TODOS OS PENDENTES ANTERIORES E GERAÇÃO DO NOVO
    const batch = writeBatch(db);
    
    // Inativação atômica de códigos antigos
    const allPendingQ = query(collection(db, "password_reset_codes"), where("userId", "==", userId), where("used", "==", false));
    const allPendingSnap = await getDocs(allPendingQ);
    allPendingSnap.forEach(d => {
      batch.update(d.ref, { used: true, usedAt: serverTimestamp(), invalidationReason: 'superseded' });
    });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 MINUTOS
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
    console.log(`[Recovery-${auditId}] Código ${otpCode} gerado e salvo para ${targetEmail}. Válido até ${expiresAt.toLocaleTimeString()}`);
    
    // 4. ENVIO DO E-MAIL (TEMPLATE OTP)
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
    console.error(`[Recovery-${auditId}] Erro Crítico:`, error.message);
    return { success: false, error: 'Erro ao processar solicitação de segurança.' };
  }
}

/**
 * Fase 2: Validar o código digitado.
 */
export async function verifyRecoveryCode(requestId: string, code: string) {
  console.log(`[Validation] Validando solicitação: ${requestId}`);
  try {
    const db = await getDb();
    const resetRef = doc(db, "password_reset_codes", requestId);
    const resetSnap = await firestoreGetDoc(resetRef);

    if (!resetSnap.exists()) return { success: false, error: "Solicitação inválida." };

    const data = resetSnap.data();
    const now = new Date();
    const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);

    if (data.used) return { success: false, error: "Código já utilizado ou invalidado." };
    if (now > expiresAt) return { success: false, error: "Código expirado (limite de 10 min)." };
    if ((data.attempts || 0) >= 10) return { success: false, error: "Muitas tentativas. Solicite um novo código." };

    if (data.code !== code) {
      await updateDoc(resetRef, { attempts: (data.attempts || 0) + 1 });
      return { success: false, error: "Código incorreto." };
    }

    console.log(`[Validation] Código validado com sucesso para requestId: ${requestId}`);
    return { success: true };
  } catch (error: any) {
    console.error("[Validation Error]", error.message);
    return { success: false, error: "Falha técnica na validação." };
  }
}

/**
 * Fase 3: Trocar a senha no Firebase Authentication.
 */
export async function resetPasswordWithCode(requestId: string, code: string, password: string) {
  console.log(`[Reset] Tentativa de alteração de senha para requestId: ${requestId}`);
  try {
    const db = await getDb();
    const resetRef = doc(db, "password_reset_codes", requestId);
    const resetSnap = await firestoreGetDoc(resetRef);

    if (!resetSnap.exists()) throw new Error("Sessão expirada.");
    const resetData = resetSnap.data();

    // Re-validação final de segurança antes de chamar o Admin SDK
    const now = new Date();
    const expiresAt = resetData.expiresAt?.toDate ? resetData.expiresAt.toDate() : new Date(resetData.expiresAt);

    if (resetData.code !== code || resetData.used || now > expiresAt) {
      return { success: false, error: "Código inválido, expirado ou já utilizado." };
    }

    const userId = resetData.userId;
    const adminAuth = getAdminAuth();
    
    // ATUALIZAÇÃO REAL NO FIREBASE AUTHENTICATION
    await adminAuth.updateUser(userId, { password });
    console.log(`[Reset] Senha do UID ${userId} atualizada via Admin SDK.`);

    // 4. INVALIDAÇÃO FINAL DE TODOS OS CÓDIGOS DO USUÁRIO
    const batch = writeBatch(db);
    const allCodesQ = query(collection(db, "password_reset_codes"), where("userId", "==", userId), where("used", "==", false));
    const allCodesSnap = await getDocs(allCodesQ);
    
    allCodesSnap.forEach(d => {
      batch.update(d.ref, { 
        used: true, 
        usedAt: serverTimestamp(),
        invalidationReason: d.id === requestId ? 'used_for_reset' : 'cleared_after_success'
      });
    });

    await batch.commit();
    return { success: true };
  } catch (error: any) {
    console.error("[Reset Critical Error]", error.message);
    return { success: false, error: "Falha técnica ao atualizar senha no servidor. Verifique permissões do Admin SDK." };
  }
}
