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
      return { ...userData, id: user.uid, isNew: true };
    }
    return { ...userSnap.data(), id: user.uid, isNew: false };
  } catch (error) {
    throw error;
  }
}

export async function startSocialRedirect(auth: Auth, providerName: 'google' | 'facebook') {
  console.log('[LOGIN] startSocialRedirect() entered');
  
  console.log('[LOGIN] Creating GoogleAuthProvider');
  const provider = providerName === 'google' 
    ? new GoogleAuthProvider() 
    : new FacebookAuthProvider();
  
  if (providerName === 'google') {
    provider.setCustomParameters({ prompt: 'select_account' });
  }
  console.log('[LOGIN] Provider created successfully');

  console.log('[LOGIN] Current URL:', window.location.href);
  console.log('[LOGIN] Auth Instance Ready:', !!auth);
  console.log('[LOGIN] Selected Method: signInWithRedirect');

  try {
    console.log('[LOGIN] Calling Firebase Authentication (signInWithRedirect)...');
    await signInWithRedirect(auth, provider);
    console.log('[LOGIN] Redirect initiated successfully. Browser should leave now.');
  } catch (error: any) {
    console.error('[LOGIN] FATAL: signInWithRedirect execution failed');
    console.error('[LOGIN] Error Code:', error.code);
    console.error('[LOGIN] Error Message:', error.message);
    console.error('[LOGIN] Error Stack:', error.stack);
    throw error;
  }
}

export async function captureRedirectResult(auth: Auth) {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      return result.user;
    }
    return null;
  } catch (error: any) {
    throw error;
  }
}
