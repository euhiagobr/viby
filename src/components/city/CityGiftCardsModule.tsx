'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Gift, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { CityModuleSection } from './CityModuleSection';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/utils';

interface CityGiftCardsModuleProps {
  giftCards: any[];
}

export function CityGiftCardsModule({ giftCards }: CityGiftCardsModuleProps) {
  if (!giftCards || giftCards.length === 0) return null;

  return (
    <CityModuleSection
      title="Gift Cards"
      description="Presenteie experiências inesquecíveis"
      icon={<Gift className="w-6 h-6" />}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {giftCards.slice(0, 6).map((giftCard) => (
          <motion.div
            key={giftCard.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            viewport={{ once: true }}
          >
            <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
              {/* Image */}
              {giftCard.image && (
                <div className="relative w-full h-48 bg-gray-200">
                  <Image
                    src={giftCard.image}
                    alt={giftCard.title}
                    fill
                    className="object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}

              {/* Content */}
              <div className="p-4 space-y-3">
                <h3 className="font-semibold text-lg line-clamp-2">
                  {giftCard.title || 'Gift Card'}
                </h3>

                {/* Description */}
                {giftCard.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {giftCard.description}
                  </p>
                )}

                {/* Price Range */}
                {giftCard.minValue && giftCard.maxValue && (
                  <div className="text-lg font-bold text-primary">
                    {formatCurrency(giftCard.minValue)} - {formatCurrency(giftCard.maxValue)}
                  </div>
                )}

                {/* CTA */}
                <button className="w-full flex items-center justify-center gap-2 text-primary text-sm font-medium hover:gap-3 transition-all">
                  <span>Comprar</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </CityModuleSection>
  );
}
