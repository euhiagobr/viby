'use client';

import React from 'react';
import Image from 'next/image';
import { Clock, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { CityModuleSection } from './CityModuleSection';
import { motion } from 'framer-motion';

interface CityReservationsModuleProps {
  reservations: any[];
}

export function CityReservationsModule({ reservations }: CityReservationsModuleProps) {
  if (!reservations || reservations.length === 0) return null;

  return (
    <CityModuleSection
      title="Reservas"
      description="Garanta seu lugar nos melhores locais"
      icon={<Clock className="w-6 h-6" />}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {reservations.slice(0, 6).map((reservation) => (
          <motion.div
            key={reservation.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            viewport={{ once: true }}
          >
            <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
              {/* Image */}
              {reservation.image && (
                <div className="relative w-full h-48 bg-gray-200">
                  <Image
                    src={reservation.image}
                    alt={reservation.title}
                    fill
                    className="object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}

              {/* Content */}
              <div className="p-4 space-y-3">
                <h3 className="font-semibold text-lg line-clamp-2">
                  {reservation.title || 'Reserva'}
                </h3>

                {/* Description */}
                {reservation.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {reservation.description}
                  </p>
                )}

                {/* Availability */}
                {reservation.availableSlots && (
                  <p className="text-sm text-green-600 font-medium">
                    {reservation.availableSlots} lugares disponíveis
                  </p>
                )}

                {/* CTA */}
                <button className="w-full flex items-center justify-center gap-2 text-primary text-sm font-medium hover:gap-3 transition-all">
                  <span>Reservar</span>
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
