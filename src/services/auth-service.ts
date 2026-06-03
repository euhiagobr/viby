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
  Firestore 
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
      // Força a seleção de conta para evitar loops em ambientes de desenvolvimento
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
    // Garante que a persistência local esteja ativa antes do popup
    await setPersistence(auth, indexedDBLocalPersistence);
    
    // Utiliza o resolver de popup para maior compatibilidade com headers COOP
    const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    const user = result.user;
    
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const userData = {
        uid: user.uid,
        email: user.email,
        name: user.displayName || "",
        photoURL: user.photoURL || "",
        provider: providerName,
        username: null,
        cpf: null,
        profileComplete: false,
        role: "user",
        status: "Ativo",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(userRef, userData);
      return { user, isNew: true };
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
