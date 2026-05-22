'use server';

import * as admin from 'firebase-admin';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { authConfig, vibyConfig } from '@/firebase/config';
import { sendPasswordResetLinkEmail } from './email';

function getAdminAuth() {
  if (admin.apps.length === 0) {
    try {
      admin.initializeApp({
        projectId: authConfig.projectId,
      });
    } catch (e) {
      console.error("Erro ao inicializar Firebase Admin:", e);
    }
  }
  return admin.auth();
}

export async function requestPasswordReset(identifier: string) {
  try {
    const authApp = getApps().find(a => a.name === "authApp") || initializeApp(authConfig, "authApp");
    const vibyApp = getApps().find(a => a.name === "vibyApp") || initializeApp(vibyConfig, "vibyApp");
    const db = getFirestore(vibyApp, 'eventosviby');
    const authAdmin = getAdminAuth();

    let email = identifier.trim().toLowerCase();
    let userName = "Usuário";

    if (!identifier.includes("@")) {
      const normalizedUsername = identifier.replace('@', '').toLowerCase().trim();
      const q = query(collection(db, "users"), where("username", "==", normalizedUsername));
      const snap = await getDocs(q);
      
      if (snap.empty) throw new Error("Usuário não encontrado.");
      
      const userData = snap.docs[0].data();
      email = userData.email;
      userName = userData.name || userData.displayName || "Usuário";
    } else {
      const q = query(collection(db, "users"), where("email", "==", email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const userData = snap.docs[0].data();
        userName = userData.name || userData.displayName || "Usuário";
      }
    }

    const resetLink = await authAdmin.generatePasswordResetLink(email);

    const emailResult = await sendPasswordResetLinkEmail({
      to: email,
      userName,
      resetLink,
      siteName: "Viby"
    });

    if (!emailResult.success) throw new Error("Erro ao disparar e-mail de segurança.");

    return { success: true, email };
  } catch (error: any) {
    console.error("Erro na redefinição de senha:", error);
    return { success: false, error: error.message };
  }
}
