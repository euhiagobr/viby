'use client';

import React from 'react';
import { CitySection } from './CitySection';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Ticket, Gift } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface CityDealsSectionProps {
  coupons: any[];
  giftCards: any[];
}

export function CityDealsSection({ coupons = [], giftCards = [] }: CityDealsSectionProps) {
  const hasDeals = (coupons && coupons.length > 0) || (giftCards && giftCards.length > 0);
  if (!hasDeals) return null;

  return (
    <CitySection
      title="Economize"
      subtitle="Cupons, promoções e ofertas imperdíveis"
      icon="🎁"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Coupons */}
        {coupons.slice(0, 3).map((coupon) => (
          <Card
            key={`coupon-${coupon.id}`}
            className="overflow-hidden hover:shadow-xl transition-shadow duration-300 rounded-lg"
          >
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <h4 className="font-bold text-lg">{coupon.title}</h4>
                  <p className="text-sm text-gray-600">{coupon.description}</p>
                </div>
                <Badge variant="secondary" className="whitespace-nowrap ml-2">
                  <Ticket className="w-4 h-4 mr-1" />
                  {coupon.discountPercentage}%
                </Badge>
              </div>

              {coupon.code && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-gray-500 mb-1">Código:</p>
                  <p className="font-mono font-bold text-sm tracking-wider">
                    {coupon.code}
                  </p>
                </div>
              )}

              {coupon.expiryDate && (
                <p className="text-xs text-gray-500">
                  Válido até {new Date(coupon.expiryDate).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
          </Card>
        ))}

        {/* Gift Cards */}
        {giftCards.slice(0, 3).map((giftCard) => (
          <Card
            key={`giftcard-${giftCard.id}`}
            className="overflow-hidden hover:shadow-xl transition-shadow duration-300 rounded-lg"
          >
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <h4 className="font-bold text-lg">{giftCard.name}</h4>
                  <p className="text-sm text-gray-600">{giftCard.description}</p>
                </div>
                <Gift className="w-6 h-6 text-gray-400 ml-2" />
              </div>

              {giftCard.minValue && (
                <div className="pt-2 border-t space-y-1">
                  <p className="text-xs text-gray-500">Valores disponíveis:</p>
                  <p className="font-bold">
                    De {formatCurrency(giftCard.minValue)} até {formatCurrency(giftCard.maxValue)}
                  </p>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </CitySection>
  );
}
