'use client';

import { 
  GoogleAuthProvider, 
  FacebookAuthProvider,
  signInWithPopup,
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
 * Garante que o documento do usuário exista no Firestore.
 */
export async function ensureUserProfile(user: User, db: Firestore) {
  console.log('[Auth-Debug] 5. entry: ensureUserProfile for UID:', user.uid);
  if (!user || !db) return null;
  
  const userRef = doc(db, "users", user.uid);
  
  try {
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.log('[Auth-Debug] 6. New user detected. Initializing profile...');
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
        metadata: { method: 'social_popup_auto_follow' }
      });

      console.log('[Auth-Debug] 7. New profile created successfully');
      return { ...userData, id: user.uid, isNew: true };
    }

    console.log('[Auth-Debug] 6. Existing user found.');
    const currentProfile = userSnap.data();
    const isActuallyComplete = !!(currentProfile.username && currentProfile.cpfHash);
    
    return { ...currentProfile, id: user.uid, profileComplete: isActuallyComplete, isNew: false };
  } catch (error) {
    console.error('[Auth-Debug] ERROR in ensureUserProfile:', error);
    throw error;
  }
}

/**
 * Inicia o login via Popup.
 * CRÍTICO: Deve ser chamado imediatamente no evento de clique para evitar bloqueios.
 */
export async function startSocialLogin(auth: Auth, providerName: 'google' | 'facebook', db: Firestore) {
  console.log('[Auth-Debug] 2. startSocialLogin popup for:', providerName);
  const provider = providerName === 'google' 
    ? new GoogleAuthProvider() 
    : new FacebookAuthProvider();

  try {
    const result = await signInWithPopup(auth, provider);
    console.log('[Auth-Debug] 3. Popup success. Ensuring profile...');
    return await ensureUserProfile(result.user, db);
  } catch (error) {
    console.error('[Auth-Debug] Popup Error:', error);
    throw error;
  }
}
