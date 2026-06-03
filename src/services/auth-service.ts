'use client';

import { 
  GoogleAuthProvider, 
  FacebookAuthProvider, 
  TwitterAuthProvider, 
  signInWithRedirect, 
  getRedirectResult,
  signOut,
  Auth,
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  setPersistence
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  serverTimestamp, 
  Firestore,
  runTransaction,
  increment,
  setDoc
} from "firebase/firestore";
import { sendWelcomeEmail } from "@/app/actions/email";
import { recordAuditLog } from "@/app/actions/audit";

export const authConfig = {
  google: true,
  facebook: false,
  x: false,
};

/**
 * Garante que o documento do usuário exista no Firestore.
 * Essencial para o fluxo de login social (Google).
 */
export async function ensureUserProfile(user: any, db: Firestore) {
  if (!user || !db) return null;
  
  const userRef = doc(db, "users", user.uid);
  console.log('[Auth-Debug] Executing ensureUserProfile for UID:', user.uid);
  
  try {
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.log('[Auth-Debug] Profile not found. Creating base document...');
      
      const initialName = user.displayName || user.email?.split('@')[0] || "Membro Viby";
      
      const userData = {
        uid: user.uid,
        email: user.email?.toLowerCase().trim() || "",
        name: initialName,
        avatar: user.photoURL || "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fprofile.jpeg?alt=media",
        provider: user.providerData[0]?.providerId || 'social',
        username: null, // Será preenchido no onboarding
        cpf: null, // Será preenchido no onboarding
        profileComplete: false,
        role: "user",
        status: "Ativo",
        followingCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Tenta localizar a conta oficial da Viby para o auto-follow
      let officialOrgId = null;
      try {
        const vibyIdxSnap = await getDoc(doc(db, "usernames", "viby"));
        if (vibyIdxSnap.exists()) officialOrgId = vibyIdxSnap.data().uid;
      } catch (e) {
        console.warn("[Auth-Debug] @viby not found for auto-follow");
      }

      await runTransaction(db, async (transaction) => {
        transaction.set(userRef, userData);
        
        if (officialOrgId) {
          const followRef = doc(db, "follows", `${user.uid}_${officialOrgId}`);
          const vibyOrgRef = doc(db, "organizations", officialOrgId);
          
          transaction.set(followRef, {
            followerId: user.uid,
            followingId: officialOrgId,
            targetType: 'organization',
            timestamp: serverTimestamp()
          });
          transaction.update(vibyOrgRef, { followersCount: increment(1) });
          userData.followingCount = 1;
        }
      });

      console.log('[Auth-Debug] Firestore Profile Created');

      // Notificações e Auditoria
      if (user.email) {
        sendWelcomeEmail({ to: user.email, userName: initialName }).catch(() => {});
      }

      await recordAuditLog({
        userId: user.uid,
        userEmail: user.email,
        action: 'signup',
        category: 'auth',
        success: true,
        metadata: { method: 'social_sync' }
      });

      return { ...userData, isNew: true };
    }

    console.log('[Auth-Debug] Profile already exists');
    return { ...userSnap.data(), isNew: false };
  } catch (error) {
    console.error('[Auth-Debug] ensureUserProfile Error:', error);
    throw error;
  }
}

/**
 * Inicia o login do Google via redirecionamento.
 */
export async function startSocialLogin(auth: Auth, providerName: 'google') {
  const provider = new GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    await setPersistence(auth, indexedDBLocalPersistence);
    return signInWithRedirect(auth, provider, browserPopupRedirectResolver);
  } catch (error) {
    console.error("[Auth-Debug] Redirect Error:", error);
    throw error;
  }
}

/**
 * Captura e processa o resultado da volta do Google.
 */
export async function handleSocialLoginResult(auth: Auth, db: Firestore) {
  try {
    const result = await getRedirectResult(auth, browserPopupRedirectResolver);
    
    if (result?.user) {
      console.log('[Auth-Debug] Redirect user captured:', result.user.email);
      const profile = await ensureUserProfile(result.user, db);
      return { user: result.user, profile };
    }

    // Se o redirect result for nulo mas o auth estiver logado (restauração de sessão)
    if (auth.currentUser) {
      console.log('[Auth-Debug] Session restored, syncing profile...');
      const profile = await ensureUserProfile(auth.currentUser, db);
      return { user: auth.currentUser, profile };
    }

    return null;
  } catch (error: any) {
    console.error(`[Auth-Debug] Redirect Result Processing Error:`, error);
    throw error;
  }
}