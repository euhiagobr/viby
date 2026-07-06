export interface CityModule {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  viewAllHref?: string;
  children: React.ReactNode;
}

export interface CityHubData {
  events: any[];
  experiences: any[];
  restaurants: any[];
  bars: any[];
  cafes: any[];
  coupons: any[];
  giftCards: any[];
  menus: any[];
  reservations: any[];
  tourism: any[];
}

export interface Organization {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
  city?: string;
  type?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
}

export interface Experience {
  id: string;
  title: string;
  description?: string;
  city: string;
  image?: string;
  price?: number;
  rating?: number;
  reviewCount?: number;
  status: string;
}

export interface Coupon {
  id: string;
  title: string;
  description?: string;
  code?: string;
  city: string;
  discountPercentage?: number;
  discountValue?: number;
  expiryDate?: string;
  isActive: boolean;
}

export interface GiftCard {
  id: string;
  title: string;
  description?: string;
  city: string;
  image?: string;
  minValue?: number;
  maxValue?: number;
  isActive: boolean;
}

export interface Reservation {
  id: string;
  title: string;
  description?: string;
  city: string;
  image?: string;
  availableSlots?: number;
  isAvailable: boolean;
}

export interface TourismAttraction {
  id: string;
  name: string;
  description?: string;
  city: string;
  category?: string;
  image?: string;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
}
