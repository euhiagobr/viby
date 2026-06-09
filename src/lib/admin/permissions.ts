
import { AdminRole, AdminPermission } from '@/types/admin';

export const ALL_PERMISSIONS: AdminPermission[] = [
  'dashboard.view',
  'users.view', 'users.edit', 'users.suspend',
  'organizations.view', 'organizations.edit', 'organizations.suspend',
  'events.view', 'events.edit', 'events.approve', 'events.reject', 'events.hide',
  'tickets.view', 'tickets.reply', 'tickets.close',
  'financial.view', 'financial.withdrawals', 'financial.refunds', 'financial.payouts',
  'marketing.view', 'marketing.coupons', 'marketing.campaigns', 'marketing.notifications', 'marketing.emails',
  'reports.view',
  'settings.view', 'settings.edit',
  'admins.view', 'admins.create', 'admins.edit', 'admins.delete', 'admins.permissions'
];

export const ROLE_PERMISSIONS_MATRIX: Record<AdminRole, AdminPermission[]> = {
  super_admin: [...ALL_PERMISSIONS],
  admin: [
    'dashboard.view',
    'users.view', 'users.edit', 'users.suspend',
    'organizations.view', 'organizations.edit', 'organizations.suspend',
    'events.view', 'events.edit', 'events.approve', 'events.reject', 'events.hide',
    'tickets.view', 'tickets.reply', 'tickets.close',
    'reports.view',
    'marketing.emails',
    'settings.view'
  ],
  support: [
    'dashboard.view',
    'users.view',
    'organizations.view',
    'events.view',
    'tickets.view', 'tickets.reply', 'tickets.close',
    'settings.view'
  ],
  financial: [
    'dashboard.view',
    'financial.view', 'financial.withdrawals', 'financial.refunds', 'financial.payouts',
    'reports.view'
  ],
  moderator: [
    'dashboard.view',
    'events.view', 'events.approve', 'events.reject', 'events.hide',
    'users.suspend'
  ],
  marketing: [
    'dashboard.view',
    'marketing.view', 'marketing.coupons', 'marketing.campaigns', 'marketing.notifications', 'marketing.emails'
  ]
};

export function getDefaultPermissionsForRole(role: AdminRole): Record<AdminPermission, boolean> {
  const allowed = ROLE_PERMISSIONS_MATRIX[role] || [];
  const permissions = {} as Record<AdminPermission, boolean>;
  ALL_PERMISSIONS.forEach(p => {
    permissions[p] = allowed.includes(p);
  });
  return permissions;
}

export function checkAdminPermission(admin: any, permission: AdminPermission): boolean {
  if (!admin || admin.status === 'Desativado') return false;
  if (admin.cargo === 'super_admin') return true;
  return !!admin.permissions?.[permission];
}
