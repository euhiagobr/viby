
'use client';

import { 
  GoogleAuthProvider, 
  FacebookAuthProvider, 
  TwitterAuthProvider, 
  signInWithPopup, 
  signOut,
  Auth
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp, 
  Firestore 
} from "firebase/firestore";

export const authConfig = {
  google: process.env.NEXT_PUBLIC_AUTH_GOOGLE === 'true' || true,
  facebook: process.env.NEXT_PUBLIC_AUTH_FACEBOOK === 'true' || false,
  x: process.env.NEXT_PUBLIC_AUTH_X === 'true' || false,
};

export async function signInWithProvider(auth: Auth, db: Firestore, providerName: 'google' | 'facebook' | 'x') {
  let provider;
  
  switch (providerName) {
    case 'google':
      provider = new GoogleAuthProvider();
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
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        photoURL: user.photoURL,
        provider: providerName,
        username: null,
        cpf: null,
        profileComplete: false,
        role: "user",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    return { user, isNew: !userSnap.exists() };
  } catch (error: any) {
    throw error;
  }
}

export async function logout(auth: Auth) {
  return signOut(auth);
}
