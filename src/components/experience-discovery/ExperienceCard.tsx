'use client';

import React, { useState } from 'react';
import { Heart, MapPin, Star, Calendar, Clock } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface ExperienceCardProps {
  id: string;
  title: string;
  image: string;
  location: string;
  category: string;
  price?: number;
  isFree?: boolean;
  rating?: number;
  reviewCount?: number;
  link: string;
  eventDate?: string;
  eventTime?: string;
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

function formatDateLabel(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  if (date.toDateString() === today.toDateString()) {
    return 'Hoje';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Amanhã';
  } else {
    return `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]}`;
  }
}

const getCategoryColor = (category: string): string => {
  const colors: Record<string, string> = {
    evento: 'bg-purple-500',
    restaurante: 'bg-orange-500',
    bar: 'bg-rose-500',
    café: 'bg-amber-600',
    experiência: 'bg-pink-500',
    passeio: 'bg-green-500'
  };
  return colors[category.toLowerCase()] || 'bg-blue-500';
};

const getCategoryColorBorder = (category: string): string => {
  const colors: Record<string, string> = {
    evento: 'border-purple-200',
    restaurante: 'border-orange-200',
    bar: 'border-rose-200',
    café: 'border-amber-200',
    experiência: 'border-pink-200',
    passeio: 'border-green-200'
  };
  return colors[category.toLowerCase()] || 'border-blue-200';
};

export function ExperienceCard({
  id,
  title,
  image,
  location,
  category,
  price,
  isFree,
  rating,
  reviewCount,
  link,
  eventDate,
  eventTime
}: ExperienceCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const finalReviewCount = reviewCount || getStableReviewCount(id);
  const dateLabel = formatDateLabel(eventDate);
  const formattedPrice = isFree || price === 0 ? 'Gratuito' : `R$${price}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.3 }}
    >
      <Link href={link}>
        <div
          className="bg-white group overflow-hidden cursor-pointer border border-gray-100 transition-all duration-300 hover:shadow-2xl hover:scale-105"
          style={{
            width: '320px',
            height: '420px',
            borderRadius: '24px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Image Container - 60% of card */}
          <div
            className="relative overflow-hidden bg-gradient-to-br from-gray-200 to-gray-100 flex-shrink-0"
            style={{
              height: '252px' /* 60% of 420px */
            }}
          >
            {image && image.trim() ? (
              <Image
                src={image}
                alt={title}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-500"
                sizes="320px"
                loading="lazy"
              />
            ) : (
              /* Premium Placeholder */
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
                <div className="text-center">
                  <div className="text-4xl mb-2">🎯</div>
                  <div className="text-xs text-gray-400 font-medium">Sem imagem</div>
                </div>
              </div>
            )}

            {/* Category Badge */}
            <div
              className={`absolute top-4 left-4 text-white ${getCategoryColor(category)}`}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                textTransform: 'capitalize'
              }}
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
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-all shadow-md"
            >
              <Heart
                className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-700'}`}
              />
            </button>
          </div>

          {/* Content - 40% of card */}
          <div className="flex-1 p-4 flex flex-col justify-between">
            {/* Title */}
            <h3
              className="text-gray-900 font-bold line-clamp-2"
              style={{
                fontSize: '16px',
                lineHeight: '1.3',
                marginBottom: '8px'
              }}
            >
              {title}
            </h3>

            {/* Location */}
            <div className="flex items-start gap-2 mb-3">
              <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <span
                className="text-gray-600 line-clamp-1 text-sm"
                style={{ fontSize: '13px' }}
              >
                {location}
              </span>
            </div>

            {/* Date & Time - PROMINENT */}
            {(eventDate || eventTime) && (
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
                <Calendar className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="font-semibold text-amber-700" style={{ fontSize: '14px' }}>
                  {dateLabel}
                  {eventTime && ` • ${eventTime}`}
                </span>
              </div>
            )}

            {/* Bottom Row: Rating + Price */}
            <div className="flex items-center justify-between">
              {/* Rating */}
              <div className="flex items-center gap-1">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-3 h-3"
                      style={{
                        fill: i < Math.round(rating || 0) ? '#fbbf24' : '#e5e7eb',
                        color: i < Math.round(rating || 0) ? '#fbbf24' : '#e5e7eb'
                      }}
                    />
                  ))}
                </div>
                {rating && (
                  <span className="text-gray-500" style={{ fontSize: '12px' }}>
                    ({finalReviewCount})
                  </span>
                )}
              </div>

              {/* Price */}
              {(price !== undefined || isFree) && (
                <span
                  className={`font-bold ${isFree || price === 0 ? 'text-green-600' : 'text-purple-600'}`}
                  style={{
                    fontSize: '16px'
                  }}
                >
                  {formattedPrice}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
