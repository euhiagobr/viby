
'use client';

import { useAuth, useUser, useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useMemo, useRef } from 'react';
import { AdminPermission, SystemAdmin } from '@/types/admin';
import { checkAdminPermission, ALL_PERMISSIONS } from '@/lib/admin/permissions';

const MASTER_ADMIN_UID = "AqTVL8VRTZT435pZudkObzMGsrR2";

/**
 * Hook para gestão de permissões administrativas.
 * Estabilizado para prevenir loops de renderização no AdminLayout.
 */
export function useAdminPermissions() {
  const auth = useAuth();
  const { user, profile, loading: userLoading, isInitialized: authInitialized } = useUser(auth);
  const db = useFirestore();

  const userId = user?.uid;
  const userRole = profile?.role;

  const adminRef = useMemo(() => 
    (db && userId) ? doc(db, 'system_admins', userId) : null, 
    [db, userId]
  );
  
  const { data: dbAdminProfile, loading: adminLoading } = useDoc<SystemAdmin>(adminRef);

  // Buffer persistente para estabilizar o objeto de saída e quebrar o ciclo de renderização
  const stableProfileRef = useRef<any>(null);

  const adminProfile = useMemo(() => {
    if (!authInitialized || userLoading || adminLoading) return null;

    let result = null;

    // 1. Prioridade: Super Admin via UID
    if (userId === MASTER_ADMIN_UID) {
      result = {
        uid: userId,
        nome: profile?.name || "Super Admin",
        sobrenome: "Viby",
        email: user?.email || "",
        cargo: 'super_admin',
        status: 'Ativo',
        permissions: ALL_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p]: true }), {} as any)
      };
    }
    // 2. Cadastro granular no Firestore
    else if (dbAdminProfile && dbAdminProfile.status !== 'Desativado') {
      result = dbAdminProfile;
    }
    // 3. Fallback: Role legada
    else if (userRole === 'admin') {
      result = {
        uid: userId,
        nome: profile?.name || "Admin",
        sobrenome: "Viby",
        email: user?.email || "",
        cargo: 'admin',
        status: 'Ativo',
        permissions: ALL_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p]: true }), {} as any)
      };
    }

    // Estabilização de referência para evitar Maximum update depth exceeded
    if (
      stableProfileRef.current && 
      result && 
      stableProfileRef.current.uid === result.uid && 
      stableProfileRef.current.cargo === result.cargo &&
      stableProfileRef.current.status === result.status
    ) {
      return stableProfileRef.current;
    }

    stableProfileRef.current = result;
    return result;
  }, [dbAdminProfile, userRole, userId, authInitialized, userLoading, adminLoading, profile?.name, user?.email]);

  const hasPermission = useMemo(() => (permission: AdminPermission) => {
    if (!adminProfile) return false;
    return checkAdminPermission(adminProfile, permission);
  }, [adminProfile]);

  const loading = !authInitialized || userLoading || adminLoading;

  return {
    adminProfile,
    hasPermission,
    isSuperAdmin: adminProfile?.cargo === 'super_admin',
    loading
  };
}
