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
  google: process.env.NEXT_PUBLIC_AUTH_GOOGLE === 'true' || true,
  facebook: process.env.NEXT_PUBLIC_AUTH_FACEBOOK === 'true' || false,
  x: process.env.NEXT_PUBLIC_AUTH_X === 'true' || false,
};

/**
 * Garante que o documento do usuário exista no Firestore.
 * @fileOverview Pipeline de sincronização de perfil social.
 */
export async function ensureUserProfile(user: any, db: Firestore) {
  if (!user || !db) return null;
  
  const userRef = doc(db, "users", user.uid);
  console.log('[Auth-Debug] Executing ensureUserProfile for UID:', user.uid);
  
  try {
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.log('[Auth-Debug] Profile not found. Creating base document for:', user.email);
      
      const initialName = user.displayName || user.email?.split('@')[0] || "Membro Viby";
      
      // Dados base do usuário
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
        console.warn("[Auth-Debug] Could not find @viby for auto-follow");
      }

      // Criação atômica do perfil
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
          // Incrementa o contador do usuário localmente no objeto que será retornado
          userData.followingCount = 1;
        }
      });

      console.log('[Auth-Debug] Firestore Profile Created Successfully');

      // Disparos assíncronos (não bloqueantes)
      if (user.email) {
        sendWelcomeEmail({ to: user.email, userName: initialName }).catch(e => console.error("Email error:", e));
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

    console.log('[Auth-Debug] Existing profile loaded for UID:', user.uid);
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
      console.log('[Auth-Debug] Initializing Google Provider Redirect');
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
    // Forçar persistência antes do redirect para garantir restauração de sessão
    await setPersistence(auth, indexedDBLocalPersistence);
    return signInWithRedirect(auth, provider, browserPopupRedirectResolver);
  } catch (error) {
    console.error("[Auth-Debug] Redirect Initiation Error:", error);
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
    
    if (!result) {
      console.log('[Auth-Debug] No redirect result found in URL/State.');
      // Se não há resultado oficial de redirect, mas o Auth já tem um usuário, 
      // significa que a sessão foi restaurada silenciosamente.
      if (auth.currentUser) {
        console.log('[Auth-Debug] Auth state restored post-redirect. Syncing profile...');
        const profile = await ensureUserProfile(auth.currentUser, db);
        return { user: auth.currentUser, profile };
      }
      return null;
    }

    console.log('[Auth-Debug] Redirect captured successfully for:', result.user.email);
    const profile = await ensureUserProfile(result.user, db);

    await recordAuditLog({
      userId: result.user.uid,
      userEmail: result.user.email,
      action: 'login',
      category: 'auth',
      success: true,
      metadata: { method: 'social_redirect', provider: result.providerId }
    });

    return { user: result.user, profile };
  } catch (error: any) {
    console.error(`[Auth-Debug] Redirect Processing Error:`, error.code, error.message);
    if (error.code === 'auth/unauthorized-domain') {
      console.error('!!! ATENÇÃO !!! Domínio não autorizado no Firebase Console.');
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
