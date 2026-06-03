'use server';

import * as admin from 'firebase-admin';
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';
import { maskEmail } from '@/lib/crypto-utils';
import { sendOTPRecoveryEmail, sendPasswordChangedNotificationEmail } from './email';
import { headers } from 'next/headers';
import { recordAuditLog } from './audit';

export async function requestPasswordRecovery(identifier: string) {
  try {
    const db = getAdminDb();
    const inputClean = identifier.trim().toLowerCase();
    const isEmail = inputClean.includes("@");
    
    let userId = "";
    let targetEmail = "";
    let userName = "";

    if (isEmail) {
      const userSnap = await db.collection("users").where("email", "==", inputClean).limit(1).get();
      if (!userSnap.empty) {
        const u = userSnap.docs[0];
        userId = u.id;
        targetEmail = u.data().email;
        userName = u.data().name || u.data().displayName || "Usuário";
      }
    } else {
      const cleanUser = inputClean.replace('@', '');
      const usernameSnap = await db.collection("usernames").doc(cleanUser).get();
      
      if (usernameSnap.exists) {
        const indexData = usernameSnap.data();
        if (indexData?.type === 'user') {
          userId = indexData.uid;
          const userSnap = await db.collection("users").doc(userId).get();
          if (userSnap.exists) {
            const uData = userSnap.data();
            targetEmail = uData?.email;
            userName = uData?.name || uData?.displayName || "Usuário";
          }
        }
      }
    }

    if (!userId || !targetEmail) {
      await recordAuditLog({
        action: 'password_recovery_request',
        category: 'auth',
        userEmail: identifier,
        success: false,
        errorMessage: "Usuário não localizado para recuperação.",
        route: '/redefinir-senha'
      });
      return { success: true, maskedEmail: "seu e-mail cadastrado" };
    }

    const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000);
    const rateSnap = await db.collection("password_reset_codes")
      .where("userId", "==", userId)
      .where("used", "==", false)
      .get();
      
    const recentRequests = rateSnap.docs.filter(d => {
      const createdAt = d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(0);
      return createdAt > twentyMinAgo;
    });

    if (recentRequests.length >= 3) {
      await recordAuditLog({
        userId,
        userEmail: targetEmail,
        action: 'password_recovery_request',
        category: 'auth',
        success: false,
        errorMessage: "Rate limit de recuperação atingido.",
        route: '/redefinir-senha'
      });
      return { success: false, error: "Muitas solicitações. Tente novamente em 20 minutos." };
    }

    const batch = db.batch();
    const allPendingSnap = await db.collection("password_reset_codes").where("userId", "==", userId).where("used", "==", false).get();
    allPendingSnap.forEach(d => {
      batch.update(d.ref, { used: true, usedAt: admin.firestore.FieldValue.serverTimestamp(), invalidationReason: 'superseded' });
    });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const resetRef = db.collection("password_reset_codes").doc();

    batch.set(resetRef, {
      email: targetEmail,
      userId: userId,
      code: otpCode,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      used: false,
      attempts: 0
    });

    await batch.commit();
    
    await sendOTPRecoveryEmail({
      to: targetEmail,
      userName: userName,
      otpCode: otpCode
    });

    await recordAuditLog({
      userId,
      userEmail: targetEmail,
      action: 'password_recovery_request',
      category: 'auth',
      success: true,
      metadata: { requestId: resetRef.id },
      route: '/redefinir-senha'
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

export async function verifyRecoveryCode(requestId: string, code: string) {
  try {
    const db = getAdminDb();
    const resetRef = db.collection("password_reset_codes").doc(requestId);
    const resetSnap = await resetRef.get();

    if (!resetSnap.exists) return { success: false, error: "Solicitação inválida." };

    const data = resetSnap.data()!;
    const now = new Date();
    const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);

    if (data.used || now > expiresAt) return { success: false, error: "Código expirado ou já utilizado." };
    if ((data.attempts || 0) >= 10) return { success: false, error: "Muitas tentativas." };

    if (data.code !== code) {
      await resetRef.update({ attempts: admin.firestore.FieldValue.increment(1) });
      return { success: false, error: "Código incorreto." };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: "Falha técnica na validação." };
  }
}

export async function resetPasswordWithCode(requestId: string, code: string, password: string) {
  try {
    const db = getAdminDb();
    const resetRef = db.collection("password_reset_codes").doc(requestId);
    const resetSnap = await resetRef.get();

    if (!resetSnap.exists) throw new Error("Sessão expirada.");
    const resetData = resetSnap.data()!;
    const now = new Date();
    const expiresAt = resetData.expiresAt?.toDate ? resetData.expiresAt.toDate() : new Date(resetData.expiresAt);

    if (resetData.code !== code || resetData.used || now > expiresAt) {
      return { success: false, error: "Código inválido ou expirado." };
    }

    const userId = resetData.userId;
    const targetEmail = resetData.email;
    const adminAuth = getAdminAuth();
    
    await adminAuth.updateUser(userId, { password });

    const batch = db.batch();
    const allCodesSnap = await db.collection("password_reset_codes").where("userId", "==", userId).where("used", "==", false).get();
    allCodesSnap.forEach(d => {
      batch.update(d.ref, { 
        used: true, 
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
        invalidationReason: d.id === requestId ? 'used_for_reset' : 'cleared_after_success'
      });
    });
    await batch.commit();

    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0] || headersList.get('x-real-ip') || 'IP não identificado';
    const city = headersList.get('x-vercel-ip-city') || headersList.get('x-apphosting-city') || 'Localização não identificada';
    const country = headersList.get('x-vercel-ip-country') || 'Brasil';
    const location = city !== 'Localização não identificada' ? `${city}, ${country}` : country;
    
    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const userSnap = await db.collection("users").doc(userId).get();
    const userData = userSnap.data();
    const userName = userSnap.exists ? (userData?.name || userData?.displayName || "Usuário") : "Usuário";

    sendPasswordChangedNotificationEmail({
      to: targetEmail,
      userName,
      ip,
      location,
      timestamp
    }).catch(e => console.warn("[Security Email] Failed to send notification", e));

    await recordAuditLog({
      userId,
      userEmail: targetEmail,
      action: 'password_reset_success',
      category: 'auth',
      success: true,
      route: '/redefinir-senha'
    });

    return { success: true };
  } catch (error: any) {
    console.error("[Reset Error]", error.message);
    return { success: false, error: "Falha técnica ao atualizar senha." };
  }
}