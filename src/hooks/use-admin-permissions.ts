
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
  const { user, profile, loading: userLoading, isInitialized: authInitialized } = useUser(auth);
  const db = useFirestore();

  const adminRef = useMemo(() => 
    (db && user) ? doc(db, 'system_admins', user.uid) : null, 
    [db, user]
  );
  
  const { data: dbAdminProfile, loading: adminLoading } = useDoc<SystemAdmin>(adminRef);

  /**
   * Resolve o perfil administrativo com suporte a fallback.
   */
  const adminProfile = useMemo(() => {
    // CRITICAL: Só avaliamos o perfil quando TODAS as fontes terminaram de carregar
    if (!authInitialized || userLoading || adminLoading) return null;

    // 1. Prioridade para a nova estrutura granular (se o documento existir)
    if (dbAdminProfile && dbAdminProfile.status !== 'Desativado') {
      return dbAdminProfile;
    }
    
    // 2. Fallback de Bootstrapping para administradores legados
    // Se o usuário tem 'admin' no perfil principal, concedemos acesso total de super_admin
    if (profile?.role === 'admin') {
      console.log('[RBAC-Fallback] Admin legado detectado. Concedendo acesso via bootstrapping.');
      return {
        uid: user?.uid,
        nome: profile.name || "Admin",
        sobrenome: "Viby",
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

  // O estado de carregamento deve ser estrito: aguarda Auth, Perfil de Usuário e Perfil de Equipe
  const loading = !authInitialized || userLoading || adminLoading;

  return {
    adminProfile,
    hasPermission,
    isSuperAdmin,
    loading
  };
}
