'use client';

import { 
  GoogleAuthProvider, 
  FacebookAuthProvider,
  signInWithPopup, 
  Auth
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

/**
 * Configuração de provedores de autenticação social ativos.
 */
export const authConfig = {
  google: true,
  facebook: true
};

/**
 * Garante que o documento do usuário exista no Firestore.
 * Implementa auto-follow do perfil @viby.
 */
export async function ensureUserProfile(user: any, db: Firestore) {
  console.log('[Auth-Debug] entry: ensureUserProfile for UID:', user.uid);
  if (!user || !db) return null;
  
  const userRef = doc(db, "users", user.uid);
  
  try {
    console.log('[Auth-Debug] Checking if user doc exists...');
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.log('[Auth-Debug] New user detected. Initializing profile...');
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
        const vibyOrgRef = doc(db, "organizations", VIBY_OFFICIAL_UID);
        
        transaction.set(followRef, {
          followerId: user.uid,
          followingId: VIBY_OFFICIAL_UID,
          targetType: 'organization',
          timestamp: serverTimestamp()
        });
        
        transaction.update(vibyOrgRef, { 
          followersCount: increment(1),
          updatedAt: serverTimestamp()
        });
      });

      if (user.email) {
        sendWelcomeEmail({ to: user.email, userName: initialName }).catch(() => {});
        sendAdminNewUserAlert({
          userName: initialName,
          username: "pendente",
          email: user.email,
          uid: user.uid
        }).catch(() => {});
      }

      await recordAuditLog({
        userId: user.uid,
        userEmail: user.email,
        action: 'signup',
        category: 'auth',
        success: true,
        metadata: { method: 'social_auto_follow' }
      });

      console.log('[Auth-Debug] New profile created successfully');
      return { ...userData, id: user.uid, isNew: true };
    }

    console.log('[Auth-Debug] Existing user found. Loading profile data...');
    const currentProfile = userSnap.data();
    const isActuallyComplete = !!(currentProfile.username && currentProfile.cpfHash);
    
    console.log('[Auth-Debug] Profile loaded. Complete?', isActuallyComplete);
    return { ...currentProfile, id: user.uid, profileComplete: isActuallyComplete, isNew: false };
  } catch (error) {
    console.error('[Auth-Debug] ERROR in ensureUserProfile:', error);
    throw error;
  }
}

/**
 * Inicia o fluxo de login via Popup.
 * CRÍTICO: Não realizar awaits pesados antes do signInWithPopup para não perder o trusted gesture.
 */
export async function startSocialLogin(auth: Auth, providerName: 'google' | 'facebook') {
  console.log('[Auth-Debug] entry: startSocialLogin for provider:', providerName);
  const provider = providerName === 'google' 
    ? new GoogleAuthProvider() 
    : new FacebookAuthProvider();

  if (providerName === 'google') {
    provider.addScope('profile');
    provider.addScope('email');
  } else {
    provider.addScope('email');
    provider.addScope('public_profile');
  }

  // O popup deve ser chamado o mais próximo possível do evento de clique
  console.log('[Auth-Debug] Triggering signInWithPopup...');
  return signInWithPopup(auth, provider);
}
