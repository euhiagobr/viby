'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { MapPin, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CityHeroPremiumProps {
  cityName: string;
  regionLabel: string;
  coverImage: string;
  stats: {
    events: number;
    experiences: number;
    restaurants: number;
    bars: number;
    cafes: number;
  };
}

export function CityHeroPremium({
  cityName,
  regionLabel,
  coverImage,
  stats
}: CityHeroPremiumProps) {
  const totalAttractions = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.7 }}
      className="relative w-full h-screen md:h-[600px] overflow-hidden flex flex-col justify-center"
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src={coverImage}
          alt={cityName}
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-4 md:px-8 space-y-12">
        {/* Region Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="flex items-center gap-2 w-fit"
        >
          <MapPin className="w-5 h-5 text-white" />
          <span className="text-white/80 font-medium text-sm md:text-base tracking-wide">
            {regionLabel}
          </span>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="max-w-3xl space-y-6"
        >
          <h1 className="text-5xl md:text-7xl font-black leading-[1.1] text-white">
            {cityName}
          </h1>

          <p className="text-lg md:text-xl text-white/90 font-light leading-relaxed max-w-lg">
            Explore eventos incríveis, restaurantes premiados, experiências únicas e os melhores lugares para descobrir.
          </p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6 max-w-3xl"
        >
          {stats.events > 0 && (
            <div className="space-y-1">
              <div className="text-2xl md:text-3xl font-black text-white">
                {stats.events}
              </div>
              <div className="text-sm text-white/70 font-medium">
                Eventos
              </div>
            </div>
          )}

          {stats.experiences > 0 && (
            <div className="space-y-1">
              <div className="text-2xl md:text-3xl font-black text-white">
                {stats.experiences}
              </div>
              <div className="text-sm text-white/70 font-medium">
                Experiências
              </div>
            </div>
          )}

          {(stats.restaurants + stats.bars + stats.cafes) > 0 && (
            <div className="space-y-1">
              <div className="text-2xl md:text-3xl font-black text-white">
                {stats.restaurants + stats.bars + stats.cafes}
              </div>
              <div className="text-sm text-white/70 font-medium">
                Lugares
              </div>
            </div>
          )}

          {totalAttractions > 0 && (
            <div className="space-y-1">
              <div className="text-2xl md:text-3xl font-black text-white">
                {totalAttractions}+
              </div>
              <div className="text-sm text-white/70 font-medium">
                Atrações
              </div>
            </div>
          )}
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="flex flex-wrap gap-3 md:gap-4"
        >
          <Button
            size="lg"
            className="bg-white text-black hover:bg-white/90 font-bold rounded-full px-8 md:px-10"
          >
            Explorar
          </Button>
          {stats.events > 0 && (
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10 font-bold rounded-full px-8 md:px-10"
            >
              Eventos ({stats.events})
            </Button>
          )}
          {(stats.restaurants + stats.bars + stats.cafes) > 0 && (
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10 font-bold rounded-full px-8 md:px-10"
            >
              Onde Comer
            </Button>
          )}
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10"
      >
        <ChevronDown className="w-6 h-6 text-white" />
      </motion.div>
    </motion.section>
  );
}
