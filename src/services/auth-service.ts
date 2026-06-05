'use client';

import { 
  GoogleAuthProvider, 
  signInWithRedirect, 
  getRedirectResult,
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

const VIBY_OFFICIAL_UID = "dd9665af-ad6d-405c-a51d-08220fecf96f";

/**
 * Configuração de provedores de autenticação social ativos.
 */
export const authConfig = {
  google: false // Desativado conforme solicitação anterior
};

/**
 * Garante que o documento do usuário exista no Firestore.
 * Implementa auto-follow do perfil @viby.
 */
export async function ensureUserProfile(user: any, db: Firestore) {
  if (!user || !db) return null;
  
  const userRef = doc(db, "users", user.uid);
  
  try {
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const initialName = user.displayName || user.email?.split('@')[0] || "Membro Viby";
      
      const userData = {
        uid: user.uid,
        email: user.email?.toLowerCase().trim() || "",
        name: initialName,
        avatar: user.photoURL || "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fprofile.jpeg?alt=media",
        provider: user.providerData[0]?.providerId || 'social',
        username: null, 
        cpf: null,
        profileComplete: false,
        role: "user",
        status: "Ativo",
        followingCount: 1, // Começa seguindo a Viby
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await runTransaction(db, async (transaction) => {
        transaction.set(userRef, userData);
        
        // Auto-follow Viby Oficial
        const followRef = doc(db, "follows", `${user.uid}_${VIBY_OFFICIAL_UID}`);
        const vibyOrgRef = doc(db, "organizations", VIBY_OFFICIAL_UID);
        
        transaction.set(followRef, {
          followerId: user.uid,
          followingId: VIBY_OFFICIAL_UID,
          targetType: 'organization',
          timestamp: serverTimestamp()
        });
        
        // Tentamos incrementar, se a org não existir a transação apenas ignora ou falha silenciosamente se não for tratada
        transaction.update(vibyOrgRef, { 
          followersCount: increment(1),
          updatedAt: serverTimestamp()
        });
      });

      if (user.email) {
        sendWelcomeEmail({ to: user.email, userName: initialName }).catch(() => {});
      }

      await recordAuditLog({
        userId: user.uid,
        userEmail: user.email,
        action: 'signup',
        category: 'auth',
        success: true,
        metadata: { method: 'social_auto_follow' }
      });

      return { ...userData, isNew: true };
    }

    const currentProfile = userSnap.data();
    const isActuallyComplete = !!(currentProfile.username && currentProfile.cpf);
    
    return { ...currentProfile, profileComplete: isActuallyComplete, isNew: false };
  } catch (error) {
    console.error('[Auth-Service] ensureUserProfile Error:', error);
    throw error;
  }
}

export async function startSocialLogin(auth: Auth, providerName: 'google') {
  if (!authConfig.google) throw new Error("Login com Google está desativado.");

  const provider = new GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    await setPersistence(auth, indexedDBLocalPersistence);
    return signInWithRedirect(auth, provider, browserPopupRedirectResolver);
  } catch (error) {
    throw error;
  }
}

export async function handleSocialLoginResult(auth: Auth, db: Firestore) {
  try {
    const result = await getRedirectResult(auth, browserPopupRedirectResolver);
    if (result?.user) {
      const profile = await ensureUserProfile(result.user, db);
      return { user: result.user, profile };
    }
    if (auth.currentUser) {
      const profile = await ensureUserProfile(auth.currentUser, db);
      return { user: auth.currentUser, profile };
    }
    return null;
  } catch (error: any) {
    throw error;
  }
}
