'use client';

import { 
  GoogleAuthProvider, 
  FacebookAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  Auth,
  User
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  serverTimestamp, 
  Firestore,
  runTransaction,
  increment
} from "firebase/firestore";
import { sendWelcomeEmail, sendAdminNewUserAlert } from "@/app/actions/email";
import { recordAuditLog } from "@/app/actions/audit";

const VIBY_OFFICIAL_UID = "dd9665af-ad6d-405c-a51d-08220fecf96f";

export const authConfig = {
  google: true,
  facebook: true
};

/**
 * Garante que o perfil do usuário exista no banco após o login social.
 */
export async function ensureUserProfile(user: User, db: Firestore) {
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
        cpfHash: null,
        profileComplete: false,
        role: "user",
        status: "Ativo",
        followingCount: 1, 
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await runTransaction(db, async (transaction) => {
        transaction.set(userRef, userData);
        const followRef = doc(db, "follows", `${user.uid}_${VIBY_OFFICIAL_UID}`);
        transaction.set(followRef, {
          followerId: user.uid,
          followingId: VIBY_OFFICIAL_UID,
          targetType: 'organization',
          timestamp: serverTimestamp()
        });
        transaction.update(doc(db, "organizations", VIBY_OFFICIAL_UID), { 
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
        success: true
      });

      return { ...userData, id: user.uid, isNew: true };
    }
    return { ...userSnap.data(), id: user.uid, isNew: false };
  } catch (error) {
    console.error('[Auth-Service] Error:', error);
    throw error;
  }
}

/**
 * Inicia o login via Redirect (Estritamente síncrono no evento de clique).
 */
export function startSocialLogin(auth: Auth, providerName: 'google' | 'facebook') {
  console.log('[Auth-Debug] 2. startSocialLogin redirect for:', providerName);
  const provider = providerName === 'google' 
    ? new GoogleAuthProvider() 
    : new FacebookAuthProvider();

  // Chamada síncrona: o retorno desta função é o início imediato do redirect
  return signInWithRedirect(auth, provider);
}

/**
 * Captura o resultado do redirecionamento no mount da página.
 */
export async function handleSocialRedirectResult(auth: Auth, db: Firestore) {
  console.log('[Auth-Debug] 3. Checking redirect result...');
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      console.log('[Auth-Debug] 4. Redirect success! User:', result.user.email);
      return await ensureUserProfile(result.user, db);
    }
    return null;
  } catch (error: any) {
    console.error('[Auth-Debug] Redirect Result Error:', error.code);
    throw error;
  }
}
