'use client';

import React, { useState } from 'react';
import { Heart, MapPin, Star, Clock, Tag } from 'lucide-react';
import { formatCurrency } from '@/lib/financial-utils';
import Image from 'next/image';
import Link from 'next/link';

interface EventCardAirbnbProps {
  event: any;
}

function getStableReviewCount(eventId: string): number {
  let hash = 0;
  for (let i = 0; i < eventId.length; i++) {
    const char = eventId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash % 180) + 20;
}

export function EventCardAirbnb({ event }: EventCardAirbnbProps) {
  const [isFavorite, setIsFavorite] = useState(false);

  const eventDate = event.date ? new Date(event.date) : null;
  const timeString = eventDate 
    ? `${String(eventDate.getHours()).padStart(2, '0')}:${String(eventDate.getMinutes()).padStart(2, '0')}`
    : '';

  const imageUrl = event.image || event.imageUrl || '/images/placeholder-event.jpg';
  const rating = event.rating || 4.8;
  const reviewCount = event.reviewCount || getStableReviewCount(event.id);
  const location = event.location || event.city || 'Localização não informada';
  const category = event.category || event.type || 'Evento';
  const price = event.price || null;

  return (
    <Link href={`/eventos/${event.id}`} className="block group">
      <div className="rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all duration-300">
        {/* Image Container */}
        <div className="relative h-64 w-full overflow-hidden bg-gray-200">
          <Image
            src={imageUrl}
            alt={event.title}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Category Badge */}
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-primary flex items-center gap-1">
            <Tag className="w-3 h-3" />
            {category}
          </div>

          {/* Favorite Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsFavorite(!isFavorite);
            }}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
          >
            <Heart
              className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-700'}`}
            />
          </button>

          {/* Time Badge */}
          <div className="absolute bottom-3 left-3 bg-black/80 text-white px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeString}
          </div>

          {/* Price Badge */}
          {price && (
            <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-lg text-sm font-bold text-primary">
              {typeof price === 'number' ? formatCurrency(price) : price}
            </div>
          )}
        </div>

        {/* Content Container */}
        <div className="p-4 space-y-3">
          {/* Title */}
          <h3 className="font-bold text-base line-clamp-2 text-gray-900 group-hover:text-primary transition-colors">
            {event.title}
          </h3>

          {/* Location */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="w-4 h-4 flex-shrink-0 text-primary" />
            <span className="line-clamp-1">{location}</span>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-gray-900 text-gray-900" />
              <span className="font-semibold text-sm text-gray-900">
                {rating.toFixed(1)}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              ({reviewCount} avaliações)
            </span>
          </div>

          {/* Description */}
          {event.description && (
            <p className="text-xs text-gray-600 line-clamp-2 pt-2">
              {event.description}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
