
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
   * Se o usuário não estiver na coleção system_admins mas for 'admin' no perfil legado,
   * concedemos acesso total para que ele possa configurar a nova equipe.
   */
  const adminProfile = useMemo(() => {
    if (!authInitialized || userLoading) return null;

    // 1. Prioridade para a nova estrutura granular (se o documento existir)
    if (dbAdminProfile && dbAdminProfile.status !== 'Desativado') {
      return dbAdminProfile;
    }
    
    // 2. Fallback de Bootstrapping para administradores legados
    // Se o snapshot de system_admins terminou e não achou nada, mas o perfil de usuário diz que é admin
    if (profile?.role === 'admin' && !adminLoading) {
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
    return checkAdminPermission(adminProfile, permission);
  };

  const isSuperAdmin = adminProfile?.cargo === 'super_admin';

  // O estado de carregamento deve ser verdadeiro enquanto qualquer uma das fontes fundamentais estiver pendente
  const loading = !authInitialized || userLoading || (adminLoading && !dbAdminProfile && !profile);

  return {
    adminProfile,
    hasPermission,
    isSuperAdmin,
    loading
  };
}
