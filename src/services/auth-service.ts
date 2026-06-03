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
  increment,
  setDoc
} from "firebase/firestore";
import { sendWelcomeEmail } from "@/app/actions/email";
import { recordAuditLog } from "@/app/actions/audit";

export const authConfig = {
  google: process.env.NEXT_PUBLIC_AUTH_GOOGLE === 'true' || true,
  facebook: process.env.NEXT_PUBLIC_AUTH_FACEBOOK === 'true' || false,
  x: process.env.NEXT_PUBLIC_AUTH_X === 'true' || false,
};

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

  await setPersistence(auth, indexedDBLocalPersistence);
  console.log(`[Auth-Debug] Iniciando login ${providerName} via redirect...`);
  return signInWithRedirect(auth, provider, browserPopupRedirectResolver);
}

/**
 * Processa o resultado do redirecionamento e executa a lógica de criação de perfil/onboarding social.
 */
export async function handleSocialLoginResult(auth: Auth, db: Firestore) {
  try {
    console.log("[Auth-Debug] Verificando resultado de redirecionamento...");
    const result = await getRedirectResult(auth, browserPopupRedirectResolver);
    
    if (!result) {
      console.log("[Auth-Debug] Nenhum evento de redirecionamento pendente.");
      return null;
    }

    const user = result.user;
    console.log("[Auth-Debug] Usuário autenticado via social:", user.uid);

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.log("[Auth-Debug] Novo usuário social detectado. Inicializando perfil...");
      
      // Captura o nome com fallback seguro
      const initialName = user.displayName || user.email?.split('@')[0] || "Membro Viby";
      
      // Tenta localizar a organização oficial para o auto-follow
      let officialOrgId = null;
      try {
        const vibyIdxSnap = await getDoc(doc(db, "usernames", "viby"));
        if (vibyIdxSnap.exists()) officialOrgId = vibyIdxSnap.data().uid;
      } catch (e) {
        console.warn("[Auth-Debug] Não foi possível localizar a conta oficial @viby para auto-follow.");
      }

      const userData = {
        uid: user.uid,
        email: user.email,
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

      // Criação transacional do perfil
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

      if (user.email) {
        sendWelcomeEmail({
          to: user.email,
          userName: initialName
        }).catch(err => console.warn("[Auth Service] Falha ao enviar e-mail de boas-vindas social", err));
      }

      await recordAuditLog({
        userId: user.uid,
        userEmail: user.email,
        action: 'signup',
        category: 'auth',
        success: true,
        metadata: { method: 'social', provider: userData.provider }
      });

      console.log("[Auth-Debug] Perfil social criado. Onboarding necessário.");
      return { user, isNew: true };
    } else {
      const data = userSnap.data();
      const isComplete = !!(data?.username && data?.cpf);
      console.log("[Auth-Debug] Usuário social já existente. Perfil Completo:", isComplete);
      
      if (data?.profileComplete !== isComplete) {
        await setDoc(userRef, { profileComplete: isComplete }, { merge: true });
      }
    }

    await recordAuditLog({
      userId: user.uid,
      userEmail: user.email,
      action: 'login',
      category: 'auth',
      success: true,
      metadata: { method: 'social' }
    });

    return { user, isNew: false };
  } catch (error: any) {
    console.error(`[Auth-Debug] Erro ao processar redirecionamento social:`, error.code, error.message);
    
    if (error.code === 'auth/unauthorized-domain') {
      console.error("[Auth-Critical] Este domínio não está autorizado no Console do Firebase!");
    }
    
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
