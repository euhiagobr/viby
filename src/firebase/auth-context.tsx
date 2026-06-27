'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  getRedirectResult 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth } from './auth';
import { db } from './database';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isInitialized: false,
});

const nowTs = () => new Date().getTime();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const hasCheckedRedirect = useRef(false);

  useEffect(() => {
    console.log(`[${nowTs()}] [AUTH-PROVIDER] 1. AuthProvider mounted`);
    console.log(`[${nowTs()}] [AUTH-PROVIDER] - URL:`, window.location.href);
    console.log(`[${nowTs()}] [AUTH-PROVIDER] - Referrer:`, document.referrer);

    const handleProfile = async (firebaseUser: User | null, source: string) => {
      console.log(`[${nowTs()}] [AUTH-PROVIDER] 5. handleProfile() from ${source}. User:`, firebaseUser?.email || 'null');
      
      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        setIsInitialized(true);
        return;
      }

      setUser(firebaseUser);
      
      try {
        console.log(`[${nowTs()}] [AUTH-PROVIDER] 6. Fetching Firestore profile for:`, firebaseUser.uid);
        const userRef = doc(db, "users", firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          console.log(`[${nowTs()}] [AUTH-PROVIDER] 7. Profile found in Firestore`);
          setProfile({ ...userSnap.data(), id: userSnap.id });
        } else {
          console.log(`[${nowTs()}] [AUTH-PROVIDER] 7. Profile NOT found. Creating initial data...`);
          const initialData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || "Usuário",
            avatar: firebaseUser.photoURL || "",
            role: "user",
            status: "Ativo",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          await setDoc(userRef, initialData);
          setProfile(initialData);
        }
      } catch (e) {
        console.error(`[${nowTs()}] [AUTH-PROVIDER] ERR: Profile sync error:`, e);
      } finally {
        setLoading(false);
        setIsInitialized(true);
      }
    };

    // 1. Capturar Resultado de Redirecionamento
    if (!hasCheckedRedirect.current) {
      hasCheckedRedirect.current = true;
      console.log(`[${nowTs()}] [AUTH-PROVIDER] 2. Executing getRedirectResult()`);
      getRedirectResult(auth)
        .then((result) => {
          console.log(`[${nowTs()}] [AUTH-PROVIDER] 3. getRedirectResult response:`, result ? 'RESULT_FOUND' : 'NULL');
          if (result) {
             console.log(`[${nowTs()}] [AUTH-PROVIDER] - OpType:`, result.operationType);
             console.log(`[${nowTs()}] [AUTH-PROVIDER] - Provider:`, result.providerId);
             console.log(`[${nowTs()}] [AUTH-PROVIDER] - User:`, result.user?.email);
             handleProfile(result.user, 'REDIRECT_RESULT');
          }
        })
        .catch((error) => {
          console.error(`[${nowTs()}] [AUTH-PROVIDER] ERR: getRedirectResult failed`);
          console.error(`[${nowTs()}] [AUTH-PROVIDER] Code:`, error.code);
          console.error(`[${nowTs()}] [AUTH-PROVIDER] Message:`, error.message);
        });
    }

    // 2. Listener de Mudança de Estado
    console.log(`[${nowTs()}] [AUTH-PROVIDER] 4. Registering onAuthStateChanged listener`);
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      console.log(`[${nowTs()}] [AUTH-PROVIDER] -> onAuthStateChanged triggered. AuthUser:`, authUser?.email || 'null');
      handleProfile(authUser, 'AUTH_STATE_CHANGED');
    });

    return () => {
      console.log(`[${nowTs()}] [AUTH-PROVIDER] Unmounting...`);
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isInitialized }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => useContext(AuthContext);
export const useUser = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useUser must be used within AuthProvider");
  return context;
};
