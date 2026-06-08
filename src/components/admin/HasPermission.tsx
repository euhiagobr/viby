
'use client';

import { ReactNode } from 'react';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { AdminPermission } from '@/types/admin';

interface HasPermissionProps {
  permission: AdminPermission;
  children: ReactNode;
  fallback?: ReactNode;
}

export function HasPermission({ permission, children, fallback = null }: HasPermissionProps) {
  const { hasPermission, loading } = useAdminPermissions();

  if (loading) return null;
  if (hasPermission(permission)) return <>{children}</>;
  return <>{fallback}</>;
}
