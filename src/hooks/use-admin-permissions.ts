
'use client';

import { useAuth, useUser, useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useMemo, useRef } from 'react';
import { AdminPermission, SystemAdmin } from '@/types/admin';
import { checkAdminPermission, ALL_PERMISSIONS } from '@/lib/admin/permissions';

const MASTER_ADMIN_UID = "AqTVL8VRTZT435pZudkObzMGsrR2";

/**
 * @fileOverview Hook resiliente para gestão de permissões administrativas.
 * Otimizado com referências estáveis para evitar loops de re-renderização no Layout.
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

  // Buffer de referência para estabilizar o objeto de saída
  const stableProfile = useRef<any>(null);

  const adminProfile = useMemo(() => {
    if (!authInitialized || userLoading || adminLoading) return null;

    let result = null;

    // 1. Prioridade: Estrutura Granular Ativa
    if (dbAdminProfile && dbAdminProfile.status !== 'Desativado') {
      result = dbAdminProfile;
    }
    // 2. Fallback: Mestre ou Role Legada
    else if (userId === MASTER_ADMIN_UID || userRole === 'admin') {
      result = {
        uid: userId,
        nome: profile?.name || "Admin",
        sobrenome: "Viby",
        email: user?.email || "",
        cargo: userId === MASTER_ADMIN_UID ? 'super_admin' : 'admin',
        status: 'Ativo',
        permissions: ALL_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p]: true }), {} as any)
      };
    }

    // Compara chaves críticas para manter a mesma referência de objeto se nada mudou
    if (
      stableProfile.current && 
      result && 
      stableProfile.current.uid === result.uid && 
      stableProfile.current.cargo === result.cargo &&
      stableProfile.current.status === result.status
    ) {
      return stableProfile.current;
    }

    stableProfile.current = result;
    return result;
  }, [dbAdminProfile, userRole, userId, authInitialized, userLoading, adminLoading, profile?.name, user?.email]);

  const hasPermission = useMemo(() => (permission: AdminPermission) => {
    if (!adminProfile) return false;
    return checkAdminPermission(adminProfile, permission);
  }, [adminProfile]);

  const isSuperAdmin = adminProfile?.cargo === 'super_admin';
  const loading = !authInitialized || userLoading || adminLoading;

  return {
    adminProfile,
    hasPermission,
    isSuperAdmin,
    loading
  };
}
