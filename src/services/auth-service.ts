'use client';

import { 
  GoogleAuthProvider, 
  FacebookAuthProvider, 
  signInWithRedirect, 
  signOut as firebaseSignOut 
} from "firebase/auth";
import { auth } from "@/firebase/auth";

/**
 * @fileOverview Auditoria de Execução do Serviço de Login.
 */

const now = () => new Date().getTime();

export async function loginWithGoogle() {
  console.log(`[${now()}] [LOGIN-TRACE] 1. loginWithGoogle() entered`);
  
  if (!auth) {
    console.error(`[${now()}] [LOGIN-TRACE] ERR: Auth instance is null`);
    return;
  }

  console.log(`[${now()}] [LOGIN-TRACE] 2. Creating GoogleAuthProvider`);
  const googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  console.log(`[${now()}] [LOGIN-TRACE] 3. Provider created. ProviderId:`, googleProvider.providerId);

  try {
    console.log(`[${now()}] [LOGIN-TRACE] 4. Calling signInWithRedirect...`);
    console.log(`[${now()}] [LOGIN-TRACE] - Auth Domain:`, (auth as any).config?.authDomain);
    console.log(`[${now()}] [LOGIN-TRACE] - Current URL:`, window.location.href);
    
    // Log do Storage antes de sair da página
    console.log(`[${now()}] [LOGIN-TRACE] - SessionStorage before redirect:`, Object.keys(sessionStorage));

    const promise = signInWithRedirect(auth, googleProvider);
    console.log(`[${now()}] [LOGIN-TRACE] 5. Redirect initiated. Promise state:`, promise);
    
    return promise;
  } catch (error: any) {
    console.error(`[${now()}] [LOGIN-TRACE] ERR: Call to signInWithRedirect failed`);
    console.error(`[${now()}] [LOGIN-TRACE] Code:`, error.code);
    console.error(`[${now()}] [LOGIN-TRACE] Message:`, error.message);
    console.error(`[${now()}] [LOGIN-TRACE] Stack:`, error.stack);
    throw error;
  }
}

export async function logout() {
  console.log(`[${now()}] [LOGIN-TRACE] logout() called`);
  return firebaseSignOut(auth);
}
