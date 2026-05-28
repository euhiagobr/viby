
'use client';

import { useState, useEffect } from 'react';
import { User, onAuthStateChanged, Auth } from 'firebase/auth';

export function useUser(auth: Auth | null) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      setIsInitialized(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      setIsInitialized(true);
    });

    return () => unsubscribe();
  }, [auth]);

  return { user, loading, isInitialized };
}
