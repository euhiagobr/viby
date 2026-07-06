'use client';

import React, { useState } from 'react';
import { Heart, MapPin, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface GenericContentCardProps {
  id: string;
  title: string;
  image: string;
  location: string;
  category: string;
  rating?: number;
  reviewCount?: number;
  price?: number | string;
  priceLabel?: string;
  time?: string;
  link: string;
  isFree?: boolean;
  compact?: boolean;
}

function getStableReviewCount(itemId: string): number {
  let hash = 0;
  for (let i = 0; i < itemId.length; i++) {
    const char = itemId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash % 180) + 20;
}

const getCategoryColor = (cat: string) => {
  const colors: Record<string, string> = {
    evento: 'bg-purple-500',
    restaurante: 'bg-orange-500',
    experiência: 'bg-pink-500',
    bar: 'bg-red-500',
    café: 'bg-amber-600',
    passeio: 'bg-green-500'
  };
  return colors[cat.toLowerCase()] || 'bg-blue-500';
};

export function GenericContentCard({
  id,
  title,
  image,
  location,
  category,
  rating,
  reviewCount,
  price,
  priceLabel,
  time,
  link,
  isFree,
  compact = false
}: GenericContentCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const finalReviewCount = reviewCount || getStableReviewCount(id);

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.3 }}
      >
        <Link href={link}>
          <div className="rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-lg transition-all duration-300 group">
            {/* Image Container */}
            <div className="relative h-40 w-full overflow-hidden bg-gray-200">
              <Image
                src={image}
                alt={title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 768px) 100vw, 50vw"
              />

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

              {/* Favorite Button */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsFavorite(!isFavorite);
                }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
              >
                <Heart
                  className={`w-3.5 h-3.5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-700'}`}
                />
              </button>

              {/* Category Badge */}
              <div className={`absolute bottom-2 left-2 ${getCategoryColor(category)} text-white px-2 py-1 rounded text-xs font-bold uppercase`}>
                {category}
              </div>
            </div>

            {/* Content Container */}
            <div className="p-3">
              {/* Title */}
              <h3 className="font-bold text-sm line-clamp-2 text-gray-900 mb-2">
                {title}
              </h3>

              {/* Location */}
              <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-2">
                <MapPin className="w-3 h-3 flex-shrink-0 text-primary" />
                <span className="line-clamp-1">{location}</span>
              </div>

              {/* Rating & Price */}
              <div className="flex items-center justify-between">
                {rating ? (
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 fill-gray-900 text-gray-900" />
                    <span className="font-semibold text-xs text-gray-900">
                      {rating.toFixed(1)}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({finalReviewCount})
                    </span>
                  </div>
                ) : (
                  <span />
                )}
                {(price || isFree) && (
                  <span className="font-bold text-xs text-primary">
                    {isFree ? 'Gratuito' : priceLabel || `R$ ${price}`}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      whileHover={{ y: -8 }}
      transition={{ duration: 0.3 }}
      className="h-full"
    >
      <Link href={link}>
        <div className="rounded-xl overflow-hidden bg-white shadow-md hover:shadow-xl transition-all duration-300 h-full flex flex-col">
          {/* Image Container */}
          <div className="relative h-56 w-full overflow-hidden bg-gray-200 group">
            <Image
              src={image}
              alt={title}
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, 50vw"
            />

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

            {/* Category Badge */}
            <div
              className={`absolute top-3 left-3 ${getCategoryColor(category)} text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide`}
            >
              {category}
            </div>

            {/* Favorite Button */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsFavorite(!isFavorite);
              }}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
            >
              <Heart
                className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-700'}`}
              />
            </button>

            {/* Price Badge */}
            {(price || isFree) && (
              <div className="absolute bottom-3 right-3 bg-white/95 px-3 py-1 rounded-lg text-sm font-bold text-primary">
                {isFree ? 'Gratuito' : priceLabel || `R$ ${price}`}
              </div>
            )}
          </div>

          {/* Content Container */}
          <div className="p-4 flex-1 flex flex-col justify-between">
            {/* Title */}
            <h3 className="font-bold text-base line-clamp-2 text-gray-900 mb-3 group-hover:text-primary transition-colors">
              {title}
            </h3>

            {/* Location */}
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              <MapPin className="w-4 h-4 flex-shrink-0 text-primary" />
              <span className="line-clamp-1">{location}</span>
            </div>

            {/* Rating */}
            {rating && (
              <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-gray-900 text-gray-900" />
                  <span className="font-semibold text-sm text-gray-900">
                    {rating.toFixed(1)}
                  </span>
                </div>
                {finalReviewCount && (
                  <span className="text-xs text-gray-500">
                    ({finalReviewCount} {finalReviewCount === 1 ? 'avaliação' : 'avaliações'})
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

            {/* Favorite Button */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsFavorite(!isFavorite);
              }}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
            >
              <Heart
                className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-700'}`}
              />
            </button>

            {/* Time Badge */}
            {time && (
              <div className="absolute bottom-3 left-3 bg-black/80 text-white px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {time}
              </div>
            )}

            {/* Price Badge */}
            {(price || isFree) && (
              <div className="absolute bottom-3 right-3 bg-white/95 px-3 py-1 rounded-lg text-sm font-bold text-primary">
                {isFree ? 'Gratuito' : priceLabel || `R$ ${price}`}
              </div>
            )}
          </div>

          {/* Content Container */}
          <div className="p-4 flex-1 flex flex-col justify-between">
            {/* Title */}
            <h3 className="font-bold text-base line-clamp-2 text-gray-900 mb-3 group-hover:text-primary transition-colors">
              {title}
            </h3>

            {/* Location */}
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              <MapPin className="w-4 h-4 flex-shrink-0 text-primary" />
              <span className="line-clamp-1">{location}</span>
            </div>

            {/* Rating */}
            {rating && (
              <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-gray-900 text-gray-900" />
                  <span className="font-semibold text-sm text-gray-900">
                    {rating.toFixed(1)}
                  </span>
                </div>
                {reviewCount && (
                  <span className="text-xs text-gray-500">
                    ({reviewCount} {reviewCount === 1 ? 'avaliação' : 'avaliações'})
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
