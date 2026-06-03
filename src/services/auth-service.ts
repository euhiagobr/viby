'use client';

import { 
  GoogleAuthProvider, 
  FacebookAuthProvider, 
  TwitterAuthProvider, 
  signInWithRedirect, 
  getRedirectResult,
  signOut,
  Auth,
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  setPersistence
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  serverTimestamp, 
  Firestore,
  runTransaction,
  increment
} from "firebase/firestore";
import { sendWelcomeEmail } from "@/app/actions/email";
import { recordAuditLog } from "@/app/actions/audit";

export const authConfig = {
  google: process.env.NEXT_PUBLIC_AUTH_GOOGLE === 'true' || true,
  facebook: process.env.NEXT_PUBLIC_AUTH_FACEBOOK === 'true' || false,
  x: process.env.NEXT_PUBLIC_AUTH_X === 'true' || false,
};

/**
 * Garante que o documento do usuário exista no Firestore.
 * Essencial para fluxos sociais onde o documento pode não ter sido criado ainda.
 */
export async function ensureUserProfile(user: any, db: Firestore) {
  if (!user || !db) return null;
  
  console.log(`[Auth-Debug] Sincronizando perfil Firestore para UID: ${user.uid}`);
  const userRef = doc(db, "users", user.uid);
  
  try {
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.log("[Auth-Debug] Perfil não encontrado. Iniciando transação de criação...");
      
      const initialName = user.displayName || user.email?.split('@')[0] || "Membro Viby";
      
      let officialOrgId = null;
      try {
        const vibyIdxSnap = await getDoc(doc(db, "usernames", "viby"));
        if (vibyIdxSnap.exists()) officialOrgId = vibyIdxSnap.data().uid;
      } catch (e) {
        console.warn("[Auth-Debug] Organização @viby não localizada para auto-follow inicial.");
      }

      const userData = {
        uid: user.uid,
        email: user.email?.toLowerCase().trim() || "",
        name: initialName,
        photoURL: user.photoURL || "",
        avatar: user.photoURL || "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fprofile.jpeg?alt=media",
        provider: user.providerData[0]?.providerId || 'social',
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
        // Criamos o perfil
        transaction.set(userRef, userData);
        
        // Seguimento automático se @viby existir
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

      console.log("[Auth-Debug] Perfil Firestore criado com sucesso!");

      if (user.email) {
        sendWelcomeEmail({ to: user.email, userName: initialName }).catch(() => {});
      }

      return { ...userData, isNew: true };
    }

    console.log("[Auth-Debug] Perfil existente localizado no Firestore.");
    return { ...userSnap.data(), isNew: false };
  } catch (error) {
    console.error("[Auth-Debug] Erro crítico ao sincronizar perfil:", error);
    throw error;
  }
}

/**
 * Inicia o fluxo de login social via Redirecionamento.
 */
export async function startSocialLogin(auth: Auth, providerName: 'google' | 'facebook' | 'x') {
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
    // Define persistência explícita antes do redirect
    await setPersistence(auth, indexedDBLocalPersistence);
    console.log(`[Auth-Debug] Disparando Redirect para ${providerName}...`);
    return signInWithRedirect(auth, provider, browserPopupRedirectResolver);
  } catch (error) {
    console.error("[Auth-Debug] Erro ao configurar persistência ou iniciar redirect:", error);
    throw error;
  }
}

/**
 * Processa o resultado do redirecionamento.
 */
export async function handleSocialLoginResult(auth: Auth, db: Firestore) {
  try {
    console.log("[Auth-Debug] Solicitando resultado de redirect ao Firebase...");
    const result = await getRedirectResult(auth, browserPopupRedirectResolver);
    
    if (!result) {
      console.log("[Auth-Debug] getRedirectResult retornou null.");
      return null;
    }

    console.log("[Auth-Debug] Usuário autenticado via redirect. Sincronizando dados...");
    const profile = await ensureUserProfile(result.user, db);

    await recordAuditLog({
      userId: result.user.uid,
      userEmail: result.user.email,
      action: 'login',
      category: 'auth',
      success: true,
      metadata: { method: 'social_redirect', provider: result.providerId }
    });

    return { user: result.user, profile, isNew: profile?.isNew };
  } catch (error: any) {
    console.error(`[Auth-Debug] Falha ao capturar resultado social:`, error.code, error.message);
    throw error;
  }
}

export async function logout(auth: Auth) {
  const user = auth.currentUser;
  if (user) {
    await recordAuditLog({
      userId: user.uid,
      userEmail: user.email,
      action: 'logout',
      category: 'auth',
      success: true
    });
  }
  return signOut(auth);
}
