'use client';

import React from 'react';
import Image from 'next/image';
import { MapPin, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { CityModuleSection } from './CityModuleSection';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

interface CityTourismModuleProps {
  attractions: any[];
}

export function CityTourismModule({ attractions }: CityTourismModuleProps) {
  if (!attractions || attractions.length === 0) return null;

  return (
    <CityModuleSection
      title="Turismo & Pontos de Interesse"
      description="Conheça os lugares imprescindíveis"
      icon={<MapPin className="w-6 h-6" />}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {attractions.slice(0, 6).map((attraction) => (
          <motion.div
            key={attraction.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            viewport={{ once: true }}
          >
            <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 h-full">
              {/* Image */}
              {attraction.image && (
                <div className="relative w-full h-48 bg-gray-200">
                  <Image
                    src={attraction.image}
                    alt={attraction.name}
                    fill
                    className="object-cover hover:scale-105 transition-transform duration-300"
                  />
                  {attraction.category && (
                    <Badge className="absolute top-2 right-2 bg-primary text-white">
                      {attraction.category}
                    </Badge>
                  )}
                </div>
              )}

              {/* Content */}
              <div className="p-4 flex flex-col justify-between h-full">
                <div>
                  <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                    {attraction.name}
                  </h3>

                  {/* Description */}
                  {attraction.description && (
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {attraction.description}
                    </p>
                  )}
                </div>

                {/* CTA */}
                <button className="mt-4 flex items-center justify-center gap-2 text-primary text-sm font-medium hover:gap-3 transition-all">
                  <span>Saiba Mais</span>
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
