
'use client';

import { useAuth, useUser, useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useMemo, useRef } from 'react';
import { AdminPermission, SystemAdmin } from '@/types/admin';
import { checkAdminPermission, ALL_PERMISSIONS } from '@/lib/admin/permissions';

const MASTER_ADMIN_UID = "AqTVL8VRTZT435pZudkObzMGsrR2";

/**
 * @fileOverview Hook resiliente para gestão de permissões administrativas.
 * Otimizado para evitar loops de renderização infinitos usando referências estáveis.
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

  // Mantemos uma referência estável para o resultado final
  const stableAdminProfile = useRef<any>(null);

  const adminProfile = useMemo(() => {
    if (!authInitialized || userLoading || adminLoading) return null;

    let result = null;

    // 1. Prioridade para a nova estrutura granular
    if (dbAdminProfile && dbAdminProfile.status !== 'Desativado') {
      result = dbAdminProfile;
    }
    // 2. Fallback de Bootstrapping
    else if (userId === MASTER_ADMIN_UID || userRole === 'admin') {
      result = {
        uid: userId,
        nome: profile?.name || "Super",
        sobrenome: "Admin",
        email: user?.email || "",
        cargo: 'super_admin',
        status: 'Ativo',
        permissions: ALL_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p]: true }), {} as any)
      };
    }

    // Se o resultado for o mesmo, mantém referência
    if (
      stableAdminProfile.current && 
      result && 
      stableAdminProfile.current.uid === result.uid && 
      stableAdminProfile.current.cargo === result.cargo
    ) {
      return stableAdminProfile.current;
    }

    stableAdminProfile.current = result;
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
