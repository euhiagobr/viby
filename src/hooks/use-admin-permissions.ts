
'use client';

import { useAuth, useUser, useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useMemo } from 'react';
import { AdminPermission, SystemAdmin } from '@/types/admin';
import { checkAdminPermission, ALL_PERMISSIONS } from '@/lib/admin/permissions';

export function useAdminPermissions() {
  const auth = useAuth();
  const { user, profile, loading: userLoading } = useUser(auth);
  const db = useFirestore();

  const adminRef = useMemo(() => 
    (db && user) ? doc(db, 'system_admins', user.uid) : null, 
    [db, user]
  );
  
  const { data: dbAdminProfile, loading: adminLoading } = useDoc<SystemAdmin>(adminRef);

  /**
   * Resolve o perfil administrativo com suporte a fallback
   */
  const adminProfile = useMemo(() => {
    if (dbAdminProfile) return dbAdminProfile;
    
    // Fallback para administradores legados (campo 'role' na coleção 'users')
    // Isso permite que administradores existentes acessem o painel para realizar a 
    // migração/configuração oficial da equipe na nova estrutura system_admins.
    if (profile?.role === 'admin') {
      return {
        uid: user?.uid,
        nome: profile.name || "Admin",
        sobrenome: "Legacy",
        email: user?.email || "",
        cargo: 'super_admin',
        status: 'Ativo',
        permissions: ALL_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p]: true }), {} as any)
      } as SystemAdmin;
    }
    
    return null;
  }, [dbAdminProfile, profile, user]);

  const hasPermission = (permission: AdminPermission) => {
    return checkAdminPermission(adminProfile, permission);
  };

  const isSuperAdmin = adminProfile?.cargo === 'super_admin';

  return {
    adminProfile,
    hasPermission,
    isSuperAdmin,
    loading: userLoading || adminLoading
  };
}
