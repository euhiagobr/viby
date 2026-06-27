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
  console.log('[AUDIT-SERVICE] Entering ensureUserProfile for:', user.email);
  if (!user || !db) return null;
  
  const userRef = doc(db, "users", user.uid);
  
  try {
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.log('[AUDIT-SERVICE] User not found in Firestore. Creating new document...');
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
      console.log('[AUDIT-SERVICE] New profile created successfully');
      return { ...userData, id: user.uid, isNew: true };
    }
    console.log('[AUDIT-SERVICE] Profile already exists in Firestore');
    return { ...userSnap.data(), id: user.uid, isNew: false };
  } catch (error) {
    console.error('[AUDIT-SERVICE] Profile Sync Critical Error:', error);
    throw error;
  }
}

export async function startSocialRedirect(auth: Auth, providerName: 'google' | 'facebook') {
  console.log('[AUDIT-FLOW] 1. Action: startSocialRedirect');
  console.log('[AUDIT-FLOW] 1.1 Provider Target:', providerName);
  console.log('[AUDIT-FLOW] 1.2 Auth Domain:', auth.config.authDomain);
  console.log('[AUDIT-FLOW] 1.3 Current URL:', window.location.href);

  const provider = providerName === 'google' 
    ? new GoogleAuthProvider() 
    : new FacebookAuthProvider();

  if (providerName === 'google') {
    provider.setCustomParameters({ prompt: 'select_account' });
  }

  console.log('[AUDIT-FLOW] 2. EXECUTION: Calling signInWithRedirect...');
  try {
    await signInWithRedirect(auth, provider);
    console.log('[AUDIT-FLOW] 2.1 Call successful. Waiting for browser to redirect...');
  } catch (error: any) {
    console.error('[AUDIT-FLOW] 2.2 FATAL: signInWithRedirect failed instantly:', error.code, error.message);
    throw error;
  }
}

export async function captureRedirectResult(auth: Auth) {
  console.log('[AUDIT-FLOW] 3. Action: captureRedirectResult');
  try {
    const result = await getRedirectResult(auth);
    console.log('[AUDIT-FLOW] 4. RESULT OBTAINED:', result);
    
    if (result) {
      console.log('[AUDIT-FLOW] 4.1 OPERATION TYPE:', result.operationType);
      console.log('[AUDIT-FLOW] 4.2 PROVIDER:', result.providerId);
      console.log('[AUDIT-FLOW] 4.3 USER OBJECT:', result.user ? 'PRESENT' : 'NULL');
      if (result.user) {
        console.log('[AUDIT-FLOW] 4.4 USER EMAIL:', result.user.email);
        console.log('[AUDIT-FLOW] 4.5 USER UID:', result.user.uid);
      }
      return result.user;
    }
    console.log('[AUDIT-FLOW] 4.1 No result found. getRedirectResult returned null');
    return null;
  } catch (error: any) {
    console.error('[AUDIT-FLOW] 4.2 REDIRECT CAPTURE ERROR:', error.code, error.message);
    throw error;
  }
}
