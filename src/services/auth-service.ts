'use client';

import { 
  GoogleAuthProvider, 
  FacebookAuthProvider, 
  TwitterAuthProvider, 
  signInWithPopup, 
  signOut,
  Auth,
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  setPersistence
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp, 
  Firestore,
  runTransaction,
  increment
} from "firebase/firestore";

export const authConfig = {
  google: process.env.NEXT_PUBLIC_AUTH_GOOGLE === 'true' || true,
  facebook: process.env.NEXT_PUBLIC_AUTH_FACEBOOK === 'true' || false,
  x: process.env.NEXT_PUBLIC_AUTH_X === 'true' || false,
};

/**
 * Serviço de autenticação social otimizado para lidar com políticas de Cross-Origin
 * e garantir persistência de sessão.
 */
export async function signInWithProvider(auth: Auth, db: Firestore, providerName: 'google' | 'facebook' | 'x') {
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

  try {
    await setPersistence(auth, indexedDBLocalPersistence);
    const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    const user = result.user;
    
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const initialName = user.displayName || user.email?.split('@')[0] || "Membro Viby";
      
      // Localizar UID da organização oficial @viby para auto-follow
      const vibyIdxSnap = await getDoc(doc(db, "usernames", "viby"));
      const officialOrgId = vibyIdxSnap.exists() ? vibyIdxSnap.data().uid : null;

      const userData = {
        uid: user.uid,
        email: user.email,
        name: initialName,
        photoURL: user.photoURL || "",
        avatar: user.photoURL || "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fprofile.jpeg?alt=media",
        provider: providerName,
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

      return { user, isNew: true };
    } else {
      const existingData = userSnap.data();
      if (!existingData.name && user.displayName) {
        await setDoc(userRef, { 
          name: user.displayName, 
          updatedAt: serverTimestamp() 
        }, { merge: true });
      }
    }

    return { user, isNew: false };
  } catch (error: any) {
    console.error(`[Auth Service Error] ${providerName}:`, error.code, error.message);
    throw error;
  }
}

export async function logout(auth: Auth) {
  return signOut(auth);
}
