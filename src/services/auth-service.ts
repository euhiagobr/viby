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
  increment
} from "firebase/firestore";
import { sendWelcomeEmail } from "@/app/actions/email";
import { recordAuditLog } from "@/app/actions/audit";

export const authConfig = {
  google: process.env.NEXT_PUBLIC_AUTH_GOOGLE === 'true' || true,
  facebook: process.env.NEXT_PUBLIC_AUTH_FACEBOOK === 'true' || false,
  x: process.env.NEXT_PUBLIC_AUTH_X === 'true' || false,
};

/**
 * Garante que o documento do usuário exista no Firestore.
 */
export async function ensureUserProfile(user: any, db: Firestore) {
  if (!user || !db) return null;
  
  const userRef = doc(db, "users", user.uid);
  console.log('[Auth-Debug] Firestore Profile Lookup Started for ensureUserProfile. UID:', user.uid);
  
  try {
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.log('[Auth-Debug] Firestore Profile Missing, creating base profile for:', user.email);
      
      const initialName = user.displayName || user.email?.split('@')[0] || "Membro Viby";
      
      let officialOrgId = null;
      try {
        const vibyIdxSnap = await getDoc(doc(db, "usernames", "viby"));
        if (vibyIdxSnap.exists()) officialOrgId = vibyIdxSnap.data().uid;
      } catch (e) {}

      const userData = {
        uid: user.uid,
        email: user.email?.toLowerCase().trim() || "",
        name: initialName,
        photoURL: user.photoURL || "",
        avatar: user.photoURL || "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fprofile.jpeg?alt=media",
        provider: user.providerData[0]?.providerId || 'social',
        username: null,
        cpf: null,
        profileComplete: false,
        role: "user",
        status: "Ativo",
        followingCount: officialOrgId ? 1 : 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

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
        }
      });

      console.log('[Auth-Debug] Firestore Profile Created Successfully');

      if (user.email) {
        sendWelcomeEmail({ to: user.email, userName: initialName }).catch(() => {});
      }

      return { ...userData, isNew: true };
    }

    console.log('[Auth-Debug] Firestore Profile Found in ensureUserProfile');
    return { ...userSnap.data(), isNew: false };
  } catch (error) {
    console.error('[Auth-Debug] Error in ensureUserProfile:', error);
    throw error;
  }
}

/**
 * Inicia o fluxo de login social via Redirecionamento.
 */
export async function startSocialLogin(auth: Auth, providerName: 'google' | 'facebook' | 'x') {
  let provider;
  
  switch (providerName) {
    case 'google':
      console.log('[Auth-Debug] Starting Google Login');
      provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      provider.setCustomParameters({ prompt: 'select_account' });
      break;
    case 'facebook':
      provider = new FacebookAuthProvider();
      break;
    case 'x':
      provider = new TwitterAuthProvider();
      break;
    default:
      throw new Error("Provedor não suportado");
  }

  try {
    // Forçar persistência antes do redirect
    await setPersistence(auth, indexedDBLocalPersistence);
    console.log('[Auth-Debug] Persistence verified before redirect');
    return signInWithRedirect(auth, provider, browserPopupRedirectResolver);
  } catch (error) {
    console.error("[Auth-Debug] Login Redirect Initiation Error:", error);
    throw error;
  }
}

/**
 * Processa o resultado do redirecionamento.
 */
export async function handleSocialLoginResult(auth: Auth, db: Firestore) {
  try {
    console.log('[Auth-Debug] Capturing redirect result...');
    const result = await getRedirectResult(auth, browserPopupRedirectResolver);
    console.log('[Auth-Debug] getRedirectResult returned:', result);
    
    if (!result) {
      // Se não houver resultado, verificamos se o usuário já foi restaurado pelo onAuthStateChanged
      if (auth.currentUser) {
        console.log('[Auth-Debug] No redirect result, but user is already present. Restoring session.');
        const profile = await ensureUserProfile(auth.currentUser, db);
        return { user: auth.currentUser, profile, isNew: profile?.isNew };
      }
      return null;
    }

    console.log('[Auth-Debug] Redirect Successful. User:', result.user.email);
    const profile = await ensureUserProfile(result.user, db);

    await recordAuditLog({
      userId: result.user.uid,
      userEmail: result.user.email,
      action: 'login',
      category: 'auth',
      success: true,
      metadata: { method: 'social_redirect', provider: result.providerId }
    });

    return { user: result.user, profile, isNew: profile?.isNew };
  } catch (error: any) {
    console.error(`[Auth-Debug] Redirect Result Error Code:`, error.code);
    console.error(`[Auth-Debug] Redirect Result Error Message:`, error.message);
    
    if (error.code === 'auth/unauthorized-domain') {
      console.error('!!! ATENÇÃO !!! O domínio atual não está autorizado no Firebase Console.');
      console.error('Acesse: Authentication > Settings > Authorized Domains e adicione:', window.location.hostname);
    }
    
    throw error;
  }
}

export async function logout(auth: Auth) {
  const user = auth.currentUser;
  if (user) {
    await recordAuditLog({
      userId: user.uid,
      userEmail: user.email,
      action: 'logout',
      category: 'auth',
      success: true
    });
  }
  return signOut(auth);
}
