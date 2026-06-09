
export type AffiliateCommissionStatus = 'pending' | 'paid' | 'cancelled' | 'reversed';

export interface CurrencyBalance {
  available: number;
  pending: number;
  totalEarned: number;
  totalWithdrawn: number;
}

export interface AffiliateStats {
  userId: string;
  totalTicketsSold: number;
  totalUsersReferred: number;
  totalOrgsLinked: number;
  currentLevel: number;
  balances: {
    BRL: CurrencyBalance;
    USD: CurrencyBalance;
    EUR: CurrencyBalance;
  };
  updatedAt: any;
}

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
  affiliateId: string;
  referredUserId: string;
  organizationId: string;
  eventId: string;
  registrationIds: string[];
  amount: number;
  currency: 'BRL' | 'USD' | 'EUR';
  status: 'pending' | 'available' | 'cancelled' | 'reversed';
  availableAt: any;
  createdAt: any;
}

export interface AffiliatePayout {
  id: string;
  userId: string;
  amount: number;
  currency: 'BRL' | 'USD' | 'EUR';
  pixKey?: string;
  pixType?: string;
  bankDetails?: string;
  status: 'Pendente' | 'Em análise' | 'Pago' | 'Cancelado';
  processedAt?: any;
  createdAt: any;
}
