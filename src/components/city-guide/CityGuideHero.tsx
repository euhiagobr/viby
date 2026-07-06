'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface CityGuideHeroProps {
  cityName: string;
  regionLabel: string;
  imageUrl?: string;
  onSearch: (query: string) => void;
}

export function CityGuideHero({
  cityName,
  regionLabel,
  imageUrl,
  onSearch
}: CityGuideHeroProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  return (
    <div className="relative h-[500px] md:h-[600px] w-full overflow-hidden">
      {/* Background Image */}
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={cityName}
          fill
          className="object-cover"
          priority
        />
      )}

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-start justify-center px-4 md:px-8 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl"
        >
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-4 leading-tight">
            O que fazer em {cityName}?
          </h1>

          <p className="text-lg md:text-xl text-white/90 mb-12 max-w-xl">
            Descubra eventos, experiências e restaurantes em um único lugar.
          </p>

          {/* Search Box */}
          <form onSubmit={handleSearch} className="w-full max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Busque lugares, eventos ou experiências..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-6 py-4 rounded-full text-base md:text-lg bg-white/95 backdrop-blur-sm placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-white p-2 rounded-full hover:bg-primary/90 transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
