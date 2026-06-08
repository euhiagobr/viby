
'use client';

import { useAuth, useUser, useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useMemo } from 'react';
import { AdminPermission, SystemAdmin } from '@/types/admin';
import { checkAdminPermission, ALL_PERMISSIONS } from '@/lib/admin/permissions';

/**
 * @fileOverview Hook resiliente para gestão de permissões administrativas.
 * Implementa bootstrapping via fallback para usuários com role 'admin' no perfil principal.
 */
export function useAdminPermissions() {
  const auth = useAuth();
  const { user, profile, loading: userLoading } = useUser(auth);
  const db = useFirestore();

  const adminRef = useMemo(() => 
    (db && user) ? doc(db, 'system_admins', user.uid) : null, 
    [db, user]
  );
  
  // Note: onSnapshot will naturally fail if rules don't exist yet, 
  // but useDoc handles the loading state.
  const { data: dbAdminProfile, loading: adminLoading } = useDoc<SystemAdmin>(adminRef);

  /**
   * Resolve o perfil administrativo com suporte a fallback.
   * Se o usuário não estiver na coleção system_admins mas for 'admin' no perfil legado,
   * concedemos acesso total para que ele possa configurar a nova equipe.
   */
  const adminProfile = useMemo(() => {
    // 1. Prioridade para a nova estrutura granular
    if (dbAdminProfile && dbAdminProfile.status !== 'Desativado') {
      return dbAdminProfile;
    }
    
    // 2. Fallback de Bootstrapping para administradores legados
    if (profile?.role === 'admin' && !adminLoading) {
      return {
        uid: user?.uid,
        nome: profile.name || "Admin",
        sobrenome: "Bootstrapper",
        email: user?.email || "",
        cargo: 'super_admin',
        status: 'Ativo',
        permissions: ALL_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p]: true }), {} as any)
      } as SystemAdmin;
    }
    
    return null;
  }, [dbAdminProfile, profile, user, adminLoading]);

  const hasPermission = (permission: AdminPermission) => {
    return checkAdminPermission(adminProfile, permission);
  };

  const isSuperAdmin = adminProfile?.cargo === 'super_admin';

  return {
    adminProfile,
    hasPermission,
    isSuperAdmin,
    loading: userLoading || (adminLoading && !profile) // Só bloqueia se não tivermos nem o perfil básico
  };
}
