'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import Image from 'next/image';

interface ExperienceHeroProps {
  cityName: string;
  regionLabel: string;
  heroImage: string;
  onSearch: (query: string) => void;
}

export function ExperienceHero({
  cityName,
  regionLabel,
  heroImage,
  onSearch
}: ExperienceHeroProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  return (
    <div className="w-full" style={{ maxWidth: '1440px', margin: '0 auto', paddingInline: '32px' }}>
      <div
        className="relative overflow-hidden flex items-center justify-center"
        style={{
          height: '570px',
          borderRadius: '32px',
          background: heroImage && heroImage.includes('/') 
            ? undefined 
            : 'linear-gradient(135deg, #002776 0%, #004B9E 50%, #7C3AED 100%)'
        }}
      >
        {/* Background Image or Gradient */}
        {heroImage && heroImage.includes('/') && !heroImage.includes('placeholder') ? (
          <Image
            src={heroImage}
            alt={cityName}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 1440px) 100vw, 1440px"
          />
        ) : (
          /* Logo Viby Centered as Fallback */
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white text-center">
              <div style={{ fontSize: '120px', marginBottom: '24px' }}>🎯</div>
              <p style={{ fontSize: '32px', fontWeight: 700, opacity: 0.3 }}>Viby</p>
            </div>
          </div>
        )}

        {/* Dark Overlay */}
        <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0, 0, 0, 0.35)' }} />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-between p-12 md:p-16">
          {/* Top Content */}
          <div style={{ maxWidth: '650px' }}>
            <h1
              className="font-bold text-white mb-4"
              style={{
                fontSize: '60px',
                lineHeight: '1.1'
              }}
            >
              O que fazer em {cityName}?
            </h1>

            <p
              className="text-white mb-12"
              style={{
                fontSize: '24px',
                fontWeight: 400,
                opacity: 0.9
              }}
            >
              Descubra os melhores lugares, eventos e experiências
            </p>

            {/* Search Box */}
            <form onSubmit={handleSubmit} className="relative w-full" style={{ maxWidth: '520px' }}>
              <input
                type="text"
                placeholder="Busque eventos, restaurantes ou experiências"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-gray-900 placeholder-gray-400"
                style={{
                  height: '60px',
                  borderRadius: '999px',
                  paddingLeft: '24px',
                  paddingRight: '60px',
                  fontSize: '16px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                }}
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
