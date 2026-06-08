
export type AffiliateCommissionStatus = 'pending' | 'paid' | 'cancelled' | 'reversed';

export interface AffiliateCode {
  id: string;
  code: string;
  userId: string;
  userName: string;
  commissionType: 'fixed';
  commissionValue: number;
  active: boolean;
  createdAt: any;
}

export interface AffiliateCommission {
  id: string;
  affiliateUserId: string;
  affiliateCode: string;
  organizationId: string;
  eventId: string;
  orderId: string;
  registrationIds: string[];
  quantity: number;
  commissionPerTicket: number;
  totalCommission: number;
  status: AffiliateCommissionStatus;
  createdAt: any;
  updatedAt?: any;
}

export interface AffiliatePayout {
  id: string;
  affiliateUserId: string;
  affiliateCode: string;
  referenceMonth: string;
  commissionCount: number;
  amount: number;
  status: 'pending' | 'paid';
  paidAt?: any;
  notes?: string;
  createdAt: any;
}
