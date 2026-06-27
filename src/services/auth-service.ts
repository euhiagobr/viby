
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

const VIBY_OFFICIAL_UID = "dd9665af-ad6d-405c-a51d-08220fecf96f";

export const authConfig = {
  google: true,
  facebook: true
};

export async function ensureUserProfile(user: User, db: Firestore) {
  if (!user || !db) return null;
  
  console.log('[Auth-Audit] 4. Processing ensureUserProfile:', user.email);
  const userRef = doc(db, "users", user.uid);
  
  try {
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.log('[Auth-Audit] 5. Creating new user document');
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
      return { ...userData, id: user.uid, isNew: true };
    }
    console.log('[Auth-Audit] 5. User document already exists');
    return { ...userSnap.data(), id: user.uid, isNew: false };
  } catch (error) {
    console.error('[Auth-Audit] Profile Sync Failed:', error);
    throw error;
  }
}

export async function startSocialRedirect(auth: Auth, providerName: 'google' | 'facebook') {
  console.log('[Auth-Audit] 1. Triggering Redirect for:', providerName);
  const provider = providerName === 'google' 
    ? new GoogleAuthProvider() 
    : new FacebookAuthProvider();

  if (providerName === 'google') {
    provider.setCustomParameters({ prompt: 'select_account' });
  }

  try {
    await signInWithRedirect(auth, provider);
  } catch (error: any) {
    console.error('[Auth-Audit] Redirect Start Error:', error.code);
    throw error;
  }
}

export async function captureRedirectResult(auth: Auth) {
  console.log('[Auth-Audit] 2. Checking Redirect Result...');
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      console.log('[Auth-Audit] 3. User found in redirect:', result.user.email);
      return result.user;
    }
    console.log('[Auth-Audit] 3. No user in redirect result');
    return null;
  } catch (error: any) {
    console.error('[Auth-Audit] 3. Redirect Capture Error:', error.code, error.message);
    throw error;
  }
}
