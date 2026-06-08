
'use client';

import { useAuth, useUser, useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useMemo } from 'react';
import { AdminPermission, SystemAdmin } from '@/types/admin';
import { checkAdminPermission } from '@/lib/admin/permissions';

export function useAdminPermissions() {
  const auth = useAuth();
  const { user } = useUser(auth);
  const db = useFirestore();

  const adminRef = useMemo(() => 
    (db && user) ? doc(db, 'system_admins', user.uid) : null, 
    [db, user]
  );
  
  const { data: adminProfile, loading } = useDoc<SystemAdmin>(adminRef);

  const hasPermission = (permission: AdminPermission) => {
    return checkAdminPermission(adminProfile, permission);
  };

  const isSuperAdmin = adminProfile?.cargo === 'super_admin';

  return {
    adminProfile,
    hasPermission,
    isSuperAdmin,
    loading
  };
}
