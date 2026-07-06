export interface CityGuideItem {
  id: string;
  title: string;
  image?: string;
  imageUrl?: string;
  location?: string;
  city?: string;
  category?: string;
  type?: string;
  rating?: number;
  reviewCount?: number;
  price?: number | string;
  priceLabel?: string;
  isFree?: boolean;
  time?: string;
  isToday?: boolean;
  isTomorrow?: boolean;
}

export interface CityGuideData {
  trending: CityGuideItem[];
  nearYou: CityGuideItem[];
  dateNight: CityGuideItem[];
  family: CityGuideItem[];
  tonight: CityGuideItem[];
  restaurants: CityGuideItem[];
  events: CityGuideItem[];
  experiences: CityGuideItem[];
}

export interface FilterChip {
  id: string;
  label: string;
  icon?: string;
}
