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
import { sendPasswordResetLinkEmail } from './email';
import { getAdminAuth } from '@/lib/firebase/admin';

/**
 * @fileOverview Ações de Recuperação de Senha (OTP de 6 dígitos).
 */

async function getDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

export async function requestPasswordRecovery(identifier: string) {
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

    // 2. RESPOSTA GENÉRICA POR SEGURANÇA
    if (!userId || !targetEmail) {
      return { success: true, maskedEmail: "seu e-mail cadastrado" };
    }

    // 3. VERIFICAÇÃO DE RATE LIMIT (3 códigos por hora por usuário)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const rateQ = query(
      collection(db, "password_reset_codes"), 
      where("userId", "==", userId),
      limit(10)
    );
    const rateSnap = await getDocs(rateQ);
    const recentRequests = rateSnap.docs.filter(d => {
      const dData = d.data();
      const createdAt = dData.createdAt?.toDate ? dData.createdAt.toDate() : new Date(0);
      return createdAt > oneHourAgo;
    });

    if (recentRequests.length >= 3) {
      return { success: false, error: "Muitas solicitações. Tente novamente em uma hora." };
    }

    // 4. INVALIDAÇÃO DE CÓDIGOS ANTERIORES E GERAÇÃO DO NOVO
    const batch = writeBatch(db);
    
    // Invalida todos os pendentes antes de criar um novo
    recentRequests.forEach(d => {
      if (!d.data().used) {
        batch.update(d.ref, { used: true, invalidationReason: 'superseded' });
      }
    });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
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
    
    // 5. ENVIO DO E-MAIL
    await sendPasswordResetLinkEmail({
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
    console.error("[Recovery Error]", error.message);
    return { success: false, error: 'Erro ao processar solicitação de segurança.' };
  }
}

export async function verifyRecoveryCode(requestId: string, code: string) {
  try {
    const db = await getDb();
    const resetRef = doc(db, "password_reset_codes", requestId);
    const resetSnap = await firestoreGetDoc(resetRef);

    if (!resetSnap.exists()) return { success: false, error: "Solicitação inválida." };

    const data = resetSnap.data();
    const now = new Date();
    const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);

    if (data.used) return { success: false, error: "Código já utilizado ou invalidado." };
    if (now > expiresAt) return { success: false, error: "Código expirou." };
    if ((data.attempts || 0) >= 10) return { success: false, error: "Muitas tentativas. Solicite um novo código." };

    if (data.code !== code) {
      const resetDocRef = doc(db, "password_reset_codes", requestId);
      await writeBatch(db).update(resetDocRef, { attempts: (data.attempts || 0) + 1 }).commit();
      return { success: false, error: "Código incorreto." };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: "Falha na validação técnica." };
  }
}

export async function resetPasswordWithCode(requestId: string, code: string, password: string) {
  try {
    const db = await getDb();
    const resetRef = doc(db, "password_reset_codes", requestId);
    const resetSnap = await firestoreGetDoc(resetRef);

    if (!resetSnap.exists()) throw new Error("Sessão expirada.");
    const resetData = resetSnap.data();

    if (resetData.code !== code || resetData.used) {
      return { success: false, error: "Código inválido ou já utilizado." };
    }

    const userId = resetData.userId;
    const adminAuth = getAdminAuth();
    
    // Atualiza a senha real no Firebase Authentication
    await adminAuth.updateUser(userId, { password });

    // Invalidação final de todos os códigos do usuário
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
    console.error("[Reset Password Error]", error.message);
    return { success: false, error: "Falha técnica ao atualizar senha no servidor." };
  }
}
