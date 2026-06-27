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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const hasCheckedRedirect = useRef(false);

  useEffect(() => {
    const handleProfile = async (firebaseUser: User | null) => {
      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        setIsInitialized(true);
        return;
      }

      setUser(firebaseUser);
      
      try {
        const userRef = doc(db, "users", firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          setProfile({ ...userSnap.data(), id: userSnap.id });
        } else {
          // Auto-provisão para primeiro login social
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
        console.error("AuthContext Profile Sync Error:", e);
      } finally {
        setLoading(false);
        setIsInitialized(true);
      }
    };

    // 1. Processar resultado de redirecionamento (Executa apenas uma vez)
    if (!hasCheckedRedirect.current) {
      hasCheckedRedirect.current = true;
      getRedirectResult(auth)
        .then((result) => {
          if (result?.user) {
            handleProfile(result.user);
          }
        })
        .catch((error) => {
          console.error("Redirect Auth Error:", error);
        });
    }

    // 2. Listener de estado de autenticação persistente
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      handleProfile(authUser);
    });

    return () => unsubscribe();
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
