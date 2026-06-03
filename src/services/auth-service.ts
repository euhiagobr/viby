
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
 * Inicia o fluxo de login social via Redirecionamento.
 */
export async function startSocialLogin(auth: Auth, providerName: 'google' | 'facebook' | 'x') {
  let provider;
  
  switch (providerName) {
    case 'google':
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

  await setPersistence(auth, indexedDBLocalPersistence);
  return signInWithRedirect(auth, provider, browserPopupRedirectResolver);
}

/**
 * Processa o resultado do redirecionamento e executa a lógica de criação de perfil/onboarding social.
 */
export async function handleSocialLoginResult(auth: Auth, db: Firestore) {
  try {
    const result = await getRedirectResult(auth, browserPopupRedirectResolver);
    if (!result) return null;

    const user = result.user;
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const initialName = user.displayName || user.email?.split('@')[0] || "Membro Viby";
      
      const vibyIdxSnap = await getDoc(doc(db, "usernames", "viby"));
      const officialOrgId = vibyIdxSnap.exists() ? vibyIdxSnap.data().uid : null;

      const userData = {
        uid: user.uid,
        email: user.email,
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

      if (user.email) {
        sendWelcomeEmail({
          to: user.email,
          userName: initialName
        }).catch(err => console.warn("[Auth Service] Falha ao enviar e-mail de boas-vindas social", err));
      }

      await recordAuditLog({
        userId: user.uid,
        userEmail: user.email,
        action: 'signup',
        category: 'auth',
        success: true,
        metadata: { method: 'social', provider: userData.provider }
      });

      return { user, isNew: true };
    }

    await recordAuditLog({
      userId: user.uid,
      userEmail: user.email,
      action: 'login',
      category: 'auth',
      success: true,
      metadata: { method: 'social' }
    });

    return { user, isNew: false };
  } catch (error: any) {
    console.error(`[Auth Service Result Error]`, error.code, error.message);
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
