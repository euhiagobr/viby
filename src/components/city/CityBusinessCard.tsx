'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Star, Phone, Globe } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

interface CityBusinessCardProps {
  id: string;
  name: string;
  avatar?: string;
  city?: string;
  type?: string;
  rating?: number;
  reviewCount?: number;
  phone?: string;
  website?: string;
  href?: string;
}

export function CityBusinessCard({
  id,
  name,
  avatar,
  city,
  type,
  rating,
  reviewCount,
  phone,
  website,
  href
}: CityBusinessCardProps) {
  const link = href || `/${name?.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      viewport={{ once: true }}
    >
      <Link href={link}>
        <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 h-full">
          {/* Image */}
          {avatar && (
            <div className="relative w-full h-48 bg-gray-200">
              <Image
                src={avatar}
                alt={name}
                fill
                className="object-cover hover:scale-105 transition-transform duration-300"
              />
              {type && (
                <Badge className="absolute top-2 right-2 bg-primary text-white">
                  {type}
                </Badge>
              )}
            </div>
          )}

          {/* Content */}
          <div className="p-4">
            <h3 className="font-semibold text-lg mb-2 line-clamp-2">{name}</h3>

            {/* Rating */}
            {rating && (
              <div className="flex items-center gap-1 mb-3">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4"
                      fill={i < Math.floor(rating) ? 'currentColor' : 'none'}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-600">
                  {rating.toFixed(1)} {reviewCount && `(${reviewCount})`}
                </span>
              </div>
            )}

            {/* Info */}
            <div className="space-y-2 text-sm text-gray-600">
              {city && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <span className="line-clamp-1">{city}</span>
                </div>
              )}

              {phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  <a href={`tel:${phone}`} className="hover:text-primary">
                    {phone}
                  </a>
                </div>
              )}

              {website && (
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 flex-shrink-0" />
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary truncate"
                  >
                    Visitar
                  </a>
                </div>
              )}
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}
