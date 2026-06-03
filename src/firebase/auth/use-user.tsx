'use client';

import { useState, useEffect } from 'react';
import { User, onAuthStateChanged, Auth } from 'firebase/auth';
import { doc, onSnapshot, Firestore } from 'firebase/firestore';
import { db } from '../database';

/**
 * @fileOverview Hook de monitoramento do estado de autenticação com logs detalhados.
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

    console.log('[Auth-Debug] Current User Before Auth State:', auth.currentUser);

    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      console.log('[Auth-Debug] onAuthStateChanged User:', authUser);
      if (authUser) {
        console.log('[Auth-Debug] User UID:', authUser.uid);
        console.log('[Auth-Debug] User Email:', authUser.email);
        console.log('[Auth-Debug] User Provider:', authUser.providerData);
        
        setUser(authUser);
        
        console.log('[Auth-Debug] Firestore Profile Lookup Started');
        const unsubscribeProfile = onSnapshot(doc(db, "users", authUser.uid), (snap) => {
          if (snap.exists()) {
            const profileData = snap.data();
            console.log('[Auth-Debug] Firestore Profile Found', profileData);
            setProfile(profileData);
          } else {
            console.log('[Auth-Debug] Firestore Profile Missing');
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
