'use client';

import React from 'react';
import { Ticket, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { CityModuleSection } from './CityModuleSection';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface CityCouponsModuleProps {
  coupons: any[];
}

export function CityCouponsModule({ coupons }: CityCouponsModuleProps) {
  if (!coupons || coupons.length === 0) return null;

  return (
    <CityModuleSection
      title="Cupons & Promoções"
      description="Descontos exclusivos para você"
      icon={<Ticket className="w-6 h-6" />}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {coupons.slice(0, 6).map((coupon) => (
          <motion.div
            key={coupon.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            viewport={{ once: true }}
          >
            <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 p-4">
              <div className="space-y-3">
                {/* Discount Badge */}
                {coupon.discountPercentage && (
                  <Badge className="bg-red-500 text-white text-base py-1">
                    -{coupon.discountPercentage}%
                  </Badge>
                )}

                {/* Title */}
                <h3 className="font-semibold text-lg line-clamp-2">
                  {coupon.title || 'Promoção Especial'}
                </h3>

                {/* Description */}
                {coupon.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {coupon.description}
                  </p>
                )}

                {/* Code */}
                {coupon.code && (
                  <div className="bg-gray-100 rounded p-2">
                    <code className="text-sm font-mono text-primary">
                      {coupon.code}
                    </code>
                  </div>
                )}

                {/* Expiry */}
                {coupon.expiryDate && (
                  <p className="text-xs text-gray-500">
                    Válido até {new Date(coupon.expiryDate).toLocaleDateString('pt-BR')}
                  </p>
                )}

                {/* CTA */}
                <button className="w-full flex items-center justify-center gap-2 text-primary text-sm font-medium hover:gap-3 transition-all">
                  <span>Usar Cupom</span>
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
