'use client';

import { 
  GoogleAuthProvider, 
  FacebookAuthProvider, 
  signInWithRedirect, 
  signOut as firebaseSignOut 
} from "firebase/auth";
import { auth } from "@/firebase/auth";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const facebookProvider = new FacebookAuthProvider();

export async function loginWithGoogle() {
  return signInWithRedirect(auth, googleProvider);
}

export async function loginWithFacebook() {
  return signInWithRedirect(auth, facebookProvider);
}

export async function logout() {
  return firebaseSignOut(auth);
}
