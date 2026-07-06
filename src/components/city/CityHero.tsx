'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Utensils, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CityHeroProps {
  cityName: string;
  regionLabel: string;
  coverImage: string;
  eventCount: number;
  experienceCount: number;
}

export function CityHero({
  cityName,
  regionLabel,
  coverImage,
  eventCount,
  experienceCount
}: CityHeroProps) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="relative w-full h-[400px] md:h-[500px] overflow-hidden"
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src={coverImage}
          alt={cityName}
          fill
          className="object-cover"
          priority
          onError={(e) => {
            e.currentTarget.src = 'https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417';
          }}
        />
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />

      {/* Content */}
      <div className="relative h-full flex flex-col justify-between p-4 md:p-8 text-white">
        {/* Top - Location */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex items-center gap-2"
        >
          <MapPin className="w-5 h-5" />
          <span className="text-sm md:text-base font-medium">{regionLabel}</span>
        </motion.div>

        {/* Bottom - Title and Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="space-y-4"
        >
          {/* Title */}
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-2 leading-tight">
              {cityName}
            </h1>
            <p className="text-sm md:text-base text-gray-200">
              Descubra o melhor da cidade
            </p>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-4 md:gap-6">
            {eventCount > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-2 bg-white/10 backdrop-blur px-3 py-2 rounded-lg"
              >
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {eventCount} {eventCount === 1 ? 'evento' : 'eventos'}
                </span>
              </motion.div>
            )}

            {experienceCount > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-2 bg-white/10 backdrop-blur px-3 py-2 rounded-lg"
              >
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {experienceCount} {experienceCount === 1 ? 'experiência' : 'experiências'}
                </span>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex items-center gap-2 bg-white/10 backdrop-blur px-3 py-2 rounded-lg"
            >
              <Utensils className="w-4 h-4" />
              <span className="text-sm font-medium">Gastronomia</span>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
