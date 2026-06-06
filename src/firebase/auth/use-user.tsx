
'use client';

import { useState, useEffect } from 'react';
import { User, onAuthStateChanged, Auth } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../database';

/**
 * @fileOverview Hook de monitoramento do estado de autenticação do usuário e perfil no Firestore.
 */
export function useUser(auth: Auth | null) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      setIsInitialized(true);
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        setUser(authUser);
        
        const unsubscribeProfile = onSnapshot(doc(db, "users", authUser.uid), (snap) => {
          if (snap.exists()) {
            setProfile(snap.data());
          } else {
            setProfile(null);
          }
          setLoading(false);
          setIsInitialized(true);
        });

        return () => unsubscribeProfile();
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
        setIsInitialized(true);
      }
    });

    return () => unsubscribeAuth();
  }, [auth]);

  return { user, profile, loading, isInitialized };
}
