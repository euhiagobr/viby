'use client';

import { useStat, useEffect, useRef } from 'react';
import { User, onAuthStateChanged, Auth } from 'firebase/auth';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../database';

/**
 * @fileOverview Hook de monitoramento do estado de autenticação e perfil.
 * Refatorado para máxima estabilidade e prevenção do erro de asserção ca9 do Firestore.
 */
export function useUser(auth: Auth | null) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const unsubProfileRef = useRef<Unsubscribe | null>(null);
  const currentUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      setIsInitialized(true);
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      // Se o UID mudou ou o usuário deslogou, limpamos o listener de perfil anterior
      if (authUser?.uid !== currentUidRef.current) {
        if (unsubProfileRef.current) {
          unsubProfileRef.current();
          unsubProfileRef.current = null;
        }
        currentUidRef.current = authUser?.uid || null;
      }

      if (authUser) {
        setUser(authUser);
        
        // Só iniciamos um novo listener se não houver um ativo para este UID
        if (!unsubProfileRef.current) {
          unsubProfileRef.current = onSnapshot(doc(db, "users", authUser.uid), (snap) => {
            if (snap.exists()) {
              setProfile({ ...snap.data(), id: snap.id });
            } else {
              setProfile(null);
            }
            setLoading(false);
            setIsInitialized(true);
          }, (err) => {
            console.warn("[useUser] Profile stream error:", err.code);
            setLoading(false);
            setIsInitialized(true);
          });
        }
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
        setIsInitialized(true);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubProfileRef.current) {
        unsubProfileRef.current();
        unsubProfileRef.current = null;
      }
    };
  }, [auth]);

  return { 
    user, 
    profile, 
    loading, 
    isInitialized,
    forceRefresh: () => setIsInitialized(false)
  };
}
