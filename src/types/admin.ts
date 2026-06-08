
export type AdminRole = 'super_admin' | 'admin' | 'support' | 'financial' | 'moderator' | 'marketing';

export type AdminPermission =
  | 'dashboard.view'
  | 'users.view' | 'users.edit' | 'users.suspend'
  | 'organizations.view' | 'organizations.edit' | 'organizations.suspend'
  | 'events.view' | 'events.edit' | 'events.approve' | 'events.reject' | 'events.hide'
  | 'tickets.view' | 'tickets.reply' | 'tickets.close'
  | 'financial.view' | 'financial.withdrawals' | 'financial.refunds' | 'financial.payouts'
  | 'marketing.view' | 'marketing.coupons' | 'marketing.campaigns' | 'marketing.notifications'
  | 'reports.view'
  | 'settings.view' | 'settings.edit'
  | 'admins.view' | 'admins.create' | 'admins.edit' | 'admins.delete' | 'admins.permissions';

export interface SystemAdmin {
  id: string; // UID do usuário
  uid: string;
  nome: string;
  sobrenome: string;
  email: string;
  telefone?: string;
  cargo: AdminRole;
  status: 'Ativo' | 'Desativado';
  permissions: Record<AdminPermission, boolean>;
  createdAt: any;
  updatedAt: any;
  createdBy: string;
}
