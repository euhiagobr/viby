
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

  const userId = user?.uid;

  const adminRef = useMemo(() => 
    (db && userId) ? doc(db, 'system_admins', userId) : null, 
    [db, userId]
  );
  
  const { data: dbAdminProfile, loading: adminLoading } = useDoc<SystemAdmin>(adminRef);

  /**
   * Resolve o perfil administrativo com suporte a fallback e UID mestre.
   * Utiliza chaves primitivas para estabilidade de referência e evita loops de re-renderização.
   */
  const adminProfile = useMemo(() => {
    if (!authInitialized || userLoading || adminLoading) return null;

    // 1. Prioridade para a nova estrutura granular (se o documento existir)
    if (dbAdminProfile && dbAdminProfile.status !== 'Desativado') {
      return dbAdminProfile;
    }
    
    // 2. Fallback de Bootstrapping para UID Mestre ou Administradores Legados
    if (userId === MASTER_ADMIN_UID || profile?.role === 'admin') {
      return {
        uid: userId,
        nome: profile?.name || "Super",
        sobrenome: "Admin",
        email: user?.email || "",
        cargo: 'super_admin',
        status: 'Ativo',
        permissions: ALL_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p]: true }), {} as any)
      } as SystemAdmin;
    }
    
    return null;
  }, [dbAdminProfile?.uid, profile?.role, userId, adminLoading, authInitialized, userLoading]);

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
