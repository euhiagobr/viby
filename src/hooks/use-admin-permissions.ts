'use client';

import { useAuth, useUser, useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useMemo } from 'react';
import { AdminPermission, SystemAdmin } from '@/types/admin';
import { checkAdminPermission, ALL_PERMISSIONS } from '@/lib/admin/permissions';

const MASTER_ADMIN_UID = "AqTVL8VRTZT435pZudkObzMGsrR2";

/**
 * @fileOverview Hook resiliente para gestão de permissões administrativas.
 * Implementa bootstrapping via fallback para a UID mestre e usuários com role 'admin'.
 */
export function useAdminPermissions() {
  const auth = useAuth();
  const { user, profile, loading: userLoading, isInitialized: authInitialized } = useUser(auth);
  const db = useFirestore();

  const adminRef = useMemo(() => 
    (db && user) ? doc(db, 'system_admins', user.uid) : null, 
    [db, user]
  );
  
  const { data: dbAdminProfile, loading: adminLoading } = useDoc<SystemAdmin>(adminRef);

  /**
   * Resolve o perfil administrativo com suporte a fallback e UID mestre.
   */
  const adminProfile = useMemo(() => {
    if (!authInitialized || userLoading || adminLoading) return null;

    // 1. Prioridade para a nova estrutura granular (se o documento existir)
    if (dbAdminProfile && dbAdminProfile.status !== 'Desativado') {
      return dbAdminProfile;
    }
    
    // 2. Fallback de Bootstrapping para UID Mestre ou Administradores Legados
    if (user?.uid === MASTER_ADMIN_UID || profile?.role === 'admin') {
      return {
        uid: user?.uid,
        nome: profile?.name || "Super",
        sobrenome: "Admin",
        email: user?.email || "",
        cargo: 'super_admin',
        status: 'Ativo',
        permissions: ALL_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p]: true }), {} as any)
      } as SystemAdmin;
    }
    
    return null;
  }, [dbAdminProfile, profile, user, adminLoading, authInitialized, userLoading]);

  const hasPermission = (permission: AdminPermission) => {
    if (!adminProfile) return false;
    return checkAdminPermission(adminProfile, permission);
  };

  const isSuperAdmin = adminProfile?.cargo === 'super_admin';

  const loading = !authInitialized || userLoading || adminLoading;

  return {
    adminProfile,
    hasPermission,
    isSuperAdmin,
    loading
  };
}
